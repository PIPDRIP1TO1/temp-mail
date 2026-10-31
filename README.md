# Temp Mail

Disposable email inbox based on the supplied screenshot. The static site lives in `dist/`.

## Run locally

Serve `dist/` with any static HTTP server, for example `npx serve dist`.

## Email service

The browser connects directly to [ZoroMail](https://zoromail.com/api-docs/) to create inboxes and fetch messages. Mailboxes saved with **Save mailbox** are stored in this browser's local storage; the current unsaved mailbox is stored for the browser session. Temporary mailboxes can expire. This does not use a custom email domain. A custom domain and inbound email provider would require separate DNS and service configuration.

The message viewer shows plain text only, so incoming HTML cannot execute code in the app. ZoroMail availability and retention are controlled by its service.
