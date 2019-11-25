require('dotenv').config();
const crypto = require('crypto')
const axios = require('axios');
const format = require('date-fns/format')
const FormData = require('form-data');
const fs = require('fs');
const path = require('path');
const redis = require("redis");
const {promisify} = require('util');
const _ = require('lodash');
const wait = require('waitms');
const hexID = require('hexid');

let {
  ORG_NAME: orgName,
  ROOT_NODE_ID: rootNodeID,
  ROOT_NODE_NAME: rootNodeName,
  SECURE_SESSION_TOKEN: sessionSecureToken,
  INITIAL_STEP_ID: initialStepID,
  SET_ID: setID
} = process.env;

const redisClient = redis.createClient();
const redisGetAsync = promisify(redisClient.get).bind(redisClient);

let nodeFetchCount = 1;

let rootNode;

function stringifyTree(node) {
  const loaded = node.loaded;

  const json = {
    id: node.id,
    name: node.name,
    location: node.location,
    title: node.title,
    personId: node.personId,
    email: loaded ? node.email : '',
    children: loaded ? node.children.map(child => stringifyTree(child)) : [],
  }

  if (node.id === rootNode.id) {
    const jsonFormatted = JSON.stringify(json, null, 2);
    fs.writeFileSync(path.join(__dirname, 'data', 'tree.json'), jsonFormatted);
    return json;
  }
  return json;
}

class Node {
  constructor({id, name, title, location, personId, data} = {}) {
    console.log('NODE', id, name);
    this.id = id;
    this.name = name;
    this.data = data;
    this.title = title;
    this.personId = personId;
    this.location = location;
    this.childrenToFetch = [];
    this.loaded = false;
    this.getChildren(data);
    this.fetchChildrenAndDetails();
  }

  async fetchChildrenAndDetails() {
    await Promise.all([
      this.fetchChildren(),
      this.fetchDetails(),
    ]);
    this.loaded = true;
  }

  setEmailWithResponse(data) {
    this.email = _.get(data, 'body.compositeViewHeader.contactInfo.primaryEmail', '');
  }

  async fetchDetails() {
    const uuid = await hexID();
    const baseUrl = `https://www.myworkday.com/${orgName}/inst/autocompletesearch/${this.personId}.htmld`;

    const cached = await redisGetAsync(baseUrl);
    if (cached) {
      const parsed = JSON.parse(cached);
      if (parsed.body) {
        this.setEmailWithResponse(parsed);
        console.log('cached', this.personId);
        return cached;
      } else {
        console.log('cached error', this.personId);
      }
    }

    const url = `${baseUrl}?clientRequestID=${uuid}`
    const res = await axios.get(url, {
      headers: {
        Cookie: process.env.COOKIE
      }
    });

    if (res.data.body) {
      redisClient.set(baseUrl, JSON.stringify(res.data))
    } else {
      console.log('Error', res.data);
    }

    this.setEmailWithResponse(res.data);
  }

  getChildren(data) {
    if (!data.body) {
      console.log('Error', data);
      return;
    }
    data.body.navigatorContainers.forEach(container => {
      if (container.navigatorDetails && container.navigatorContainerNodeType === 'CHILD_NODES_AND_LEAVES') {
        container.navigatorDetails.forEach(detail => {
          if (detail.navigatorInstance && detail.navigatorInstance.instances) {
            detail.navigatorInstance.instances.forEach(instance => {
              this.childrenToFetch.push({
                id: instance.instanceId,
                personId: instance.instanceId,
                name: instance.text,
                title: detail.navigatorItems[0].detailOne,
                location: detail.navigatorItems[0].detailTwo,
              })
            })
          }
        })
      }
    })
    if (this.childrenToFetch.length) {
      const selfContainer = data.body.navigatorContainers.find(container => container.navigatorContainerNodeType === 'SELF');
      const personId = _.get(selfContainer, 'navigatorDetails[0].navigatorItems[0].owner.instances[0].instanceId');
      const name = _.get(selfContainer, 'navigatorDetails[0].navigatorItems[0].owner.instances[0].text');

      this.name = name;
      this.personId = personId;
    }
  }

  static createUrlFromId(id) {
    return `https://www.myworkday.com/${orgName}/navigable/${id}.htmld`;
  }

  async fetchChildren() {
    console.log('TO FETCH', this.childrenToFetch);

    const promises = await Promise.all(this.childrenToFetch.map(async ({id, name}) => {
      const cached = await getCache(id);
      if (cached) {
        const parsed = JSON.parse(cached);
        if (parsed.body) {
          return parsed;
        }
      }
      return fetchNode({id, name});
    }));

    this.children = promises.map((childData, index) => {
      const {id, name, title, location, personId} = this.childrenToFetch[index];
      return new Node({
        id,
        name,
        data: childData,
        title,
        location,
        personId
      });
    })
    
    return Promise.all(this.children)
  }
}

const cookie = process.env.COOKIE;

function getCache(id) {
  const url = Node.createUrlFromId(id);
  return redisGetAsync(url);
}

function setCache(key, val) {
  return redisClient.set(key, val);
}

async function fetchNode({id, name}) {
  const uuid = await hexID();

  const url = Node.createUrlFromId(id);

  nodeFetchCount++;

  await wait(25 * nodeFetchCount);

  console.log('Fetching', id, name);

  const form =  new FormData();
  form.append('initial-step', initialStepID);
  form.append('navigable-instance-iid', id);
  form.append('navigable-instance-did', name);
  form.append('navigable-instance-set-id', setID);
  form.append('sessionSecureToken', sessionSecureToken);
  form.append('clientRequestID', uuid);
  form.append('effective', format(new Date(), "yyyy-MM-dd-HH:mm"))

  const formHeaders = form.getHeaders();

  const res = await axios.post(url, form, {
    headers: {
      Cookie: cookie,
      ...formHeaders
    },
  });

  if (res.data.body) {
    // Don't cache errors
    setCache(url, JSON.stringify(res.data));
  }

  sessionSecureToken = res.data.sessionSecureToken;

  return res.data;
}

(async () => {
  const nodeOpts = {id: rootNodeID, name: rootNodeName};
  const data = await fetchNode(nodeOpts);
  nodeOpts.data = data;
  rootNode = new Node(nodeOpts);

  setInterval(() => {
    stringifyTree(rootNode);
  }, 10000);
})();