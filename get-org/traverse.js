const tree = require('./data/tree.json');

function handleNode(node) {
  // Do something with `node` here
}

const queue = [tree];

while (queue.length) {
  const node = queue.shift();
  node.children.forEach(child => {
    queue.push(child);
  });
  handleNode(node);
}
