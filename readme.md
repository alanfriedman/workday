# Workday Scripts

## get-org

Models the entire organization a tree and saves to JSON file. Includes name, title, location and email of each person.

### Setup

Copy `.env.example` to `.env`

1. Open developer tools to the Network tab.
2. Sign in to Workday and navigate to the graphical Org Chart view.
3. The URL should look like this: `https://www.myworkday.com/ORG_NAME/d/inst/ID_1/rel-task/ID_2.htmld`. Copy ORG_NAME from the URL into your `.env` file
4. Scroll to the top node of the org tree. This should be the CEO/President/Founder of the company.
5. Filter Network requests for `navigable`. You should see a POST request to a URL that looks like this: `https://www.myworkday.com/ORG_NAME/navigable/ID.htmld`
6. Inspect the request and find the Form Data that was sent. Copy the values to your `.env` file, mapping as follows:
- navigable-instance-iid => ROOT_NODE_ID
- navigable-instance-did => ROOT_NODE_NAME
- initial-step => INITIAL_STEP_ID
- sessionSecureToken => SECURE_SESSION_TOKEN
- navigable-instance-set-id => INITIAL_STEP_ID
7. Copy the `Cookie` request header to your `.env` file and name it `COOKIE`

Start Redis on localhost port 6379

```
redis-server
```

### Run

This will write a JSON tree representation to disk at `get-org/data/tree.json`. The first run could take 10-30 minutes. You can exit the process and restart anytime.

```
node get-org
```

### Example JSON output

```
{
  "id": "123$4567",
  "name": "Jennifer Doe",
  "location": "123 Sesame St",
  "title": "VP, Marketing",
  "personId": "123$4567",
  "email": "jenniferdoe@acme.org",
  "children": [
    {
      "id": "123$4567",
      "name": "Michael Doe",
      "location": "123 Sesame St",
      "title": "Director, Marketing",
      "personId": "123$4567",
      "email": "michaeldoe@acme.org",
      "children": [
        {
          "id": "123$4567",
          "name": "Jim Doe",
          "location": "123 Sesame St",
          "title": "Senior Manager, Marketing",
          "personId": "123$4567",
          "email": "jimdoe@acme.org",
          "children": [
            {
              "id": "123$4567",
              "name": "Matt Doe",
              "location": "123 Sesame St",
              "title": "Manager, Marketing",
              "personId": "123$4567",
              "email": "mattdoe@acme.org",
              "children": []
            }
          ]
        }
      ]
    }
  ]
}
```