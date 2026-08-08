# Users Access Frontend

## Quick Start

```bash
git clone <repo_url>
cp .env.example .env
npm install
npm run dev
```

**IMPORTANT**:
* backend must be up an running for this frontend to work
* `VITE_API_URL`'s port must match the `PORT` exposed by backend; they already match in the .env.example files, so you do not have to do anything


## Capablity Model

A **Principal** is a user or an integration, i.e the subject that receive the grant.

A **Grant** is an entity associated to a user or an integration; it has a scope, it can have a role (which is a preset of capabilities), and has a certain number of capabilities. 

A **Capability** is a couple `resource:action`. in the backend service, it is a many-to-many table (`capabilities`) that links `resources` table and `actions` table. In this way, the capabilities are completely parametric, any set of resource and action cna be easily composed.

Principals can have multiple grants i.e. a user can have a grant on an organization, then have another grant on a particular project.

During the creation of a grant, the user can select a role, and a preset of capabilities is selected. The user can confirm this preset or allow/deny capabilities. Allow/deny works like diff in git: allowed capabilites are added to the prset, denied capabilities are capaiblities in the preset that the usr explicitly removes.

## People and Integrations

The grants assigned to people and integrations are stored in the same table `access_grants`. the difference is on how the grant is saved: if it is a user's grant, it is save with `email`, if it is a integration's grant, it is saved with `integrationId`.

The flow of creation at frontend level is the same, the only difference is on the input data provided in thedialog box.

## URL Structure

* `/`: basic landing page with 2 buttons that redirect to surfaces 1 and 2 from the requirements document.
* `/access-editor`: route that allows to create/edit/delete grants
* `/organization-members`: route that allows to see all the users that belong to organizations and clients the logged user can see

## Where to Add New Resource

Go to the backend folder (users-access-backend); in /data/resources.json, add a new record

```json
{
    "id": 8,
    "name": "new resource name"
}
```

## With More Time

* implement the "fail on demand" of the API calls
* implement a login with a check whether the user is an "ops lead" or "super amin"; if he is, he can see and work in `/access-editor` and `/organization-members`; if he is not, he will not be able to see these pages
* improve data lineage: insert changelog on grants to see their history (who created them and when, who updated them and when, ...)
* implement a permission gate; every action the user does (video-view, image:export, ...), the application asks to the backend if the user has that capability granted on that scope
* implement "super admin" capabilities, a set of capabilities that differ from normal users and are more focused on whether the super admin can create/edit/delete a grant
* implement a limitation on the capabilities the super admin/ops lead should can assign based on its own capabilities; this is already specified in the requirements, but for lack of time it was not implemented
* improve scopes management; in this moment the user can assing a scope choosing between an org, a client or a project; that's it; but if the assigned scope is an organization with multiple clients and projects, the application should ask the user if he wants the user to see all the clients and projects under tht organization, or if he wants to select a subset;
* implement a more sophisticated error management
* seed more data to handle different cases
* implement Auth on endpoints: the backend endpoints return error 401 or 403 in case no token / non-valid token is given