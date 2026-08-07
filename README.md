# Users Access Frontend

## Quick Start

```powershell
git clone <repo_url>
npm install
npm run dev
```


## With more time

* implement a login with an check whether the user is an "ops lead"/"super amin"; if he is, he can see and work in /access-editor and /organization-members; if he is not, he will not be able to see these pages
* improve data lineage: insert changelog on grants to see their history (who created them and when, who updated them and when, ...)
* implement a permission gate; every action the user does (video-view, image:export, ...), the application asks to the backend if the user has that capability granted on that scope
* improve scopes management; in this moment the user can assing a scope choosing between an org, a client or a project; that's it; but if the assigned scope is an organization with multiple clients and projects, the application should ask the user if he wants the user to see all the clients and projects under tht organization, or if he wants to select a subset;
* implement a more sophisticated error management
* seed more data to handle different cases
* implement Auth on endpoints: the backend endpoints return error 401 or 403 in case no token / non-valid token is given