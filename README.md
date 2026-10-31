# Temp Mail

Disposable email inbox based on the supplied screenshot. The static site lives in `dist/`.

## Run locally

Serve `dist/` with any static HTTP server, for example `npx serve dist`.

## Email service

The browser connects directly to [Mail123](https://mail123.click/api) to create inboxes and fetch messages. Mailboxes saved with **Save mailbox** are stored in this browser's local storage; the current unsaved mailbox is stored for the browser session. These inboxes do not require authentication: anyone who knows an address can read it. Mail123 deletes inactive inboxes after seven days. This does not use a custom email domain. A custom domain and inbound email provider would require separate DNS and service configuration.

The message viewer shows plain text only, so incoming HTML cannot execute code in the app. Mail123 availability and retention are controlled by its service.
