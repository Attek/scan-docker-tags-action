const fetch = require("node-fetch")
const core = require('@actions/core');


let repoUrl, namespace, repository, regex, maxAgeMinutes, username, password
try {
  repoUrl       = core.getInput("repo-url")
  namespace     = core.getInput("namespace")
  repository    = core.getInput("repository")
  regex         = new RegExp(core.getInput("tag-regex"))
  maxAgeMinutes = parseInt(core.getInput("max-age-minutes"))
  username      = core.getInput("username")
  password      = core.getInput("password")
} catch (err) {
  const msg = "Failed to initialize action: " + err.message
  core.setFailed(msg)
  console.error(msg)
  console.error(err)
  process.exit(1)
}

fetch(`${repoUrl}/v2/users/login/`, {
  method: "POST",
  headers: {
    "Content-Type": "application/json"
  },
  body: JSON.stringify({ username, password })
})
.then(processResponse)
.then(({ token }) => {
  return fetch(`${repoUrl}/v2/namespaces/${namespace}/repositories/${repository}/tags?page_size=100`, {
    headers: {
      "Authorization": `Bearer ${token}`,
      "Content-Type": "application/json"
    }
  })
})
.then(processResponse)
.then(({ results }) => {
  const tags = 
    results.sort(byDateAsc)
    .filter(filterOldEntry)
    .filter(el => regex.test(el.name))
    .map(el => el.name)
    .join(",")

  core.setOutput("tags", tags)
})
.catch((err) => {
  const msg = "Failed to scan Docker repository: " + err.message
  core.setFailed(msg)
  console.error(msg)
  console.error(err)
  process.exit(1)
})



function processResponse(res) {
  if(res.status < 400) {
    return res.json()
  } else {
    return Promise.reject(new Error(`Response from server: '${res.statusText}' (${res.status}) for URL ${res.url}`))
  }
}

function byDateAsc(a, b) {
  return new Date(a.last_updated) - new Date(b.last_updated)
}

function filterOldEntry(entry) {
  const now       = new Date()
  const entryDate = new Date(entry.last_updated)
  return (now - entryDate) < maxAgeMinutes * 60 * 1000
}