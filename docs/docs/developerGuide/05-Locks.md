Locks exist in Ketida in order to ensure that only a single person can edit a book component at any given time. When a user with the appropriate permissions opens a document, they acquire the lock on that document.

### Database

Locks exist as a separate table on the database, as in theory, any object could have a locking mechanism attached to it. For the time being, the only objects that do have a lock attached to them are book components.

The table has the following properties:

| Property       | Description                                                                              |
| -------------- | ---------------------------------------------------------------------------------------- |
| `userId`       | Who acquired the lock                                                                    |
| `foreignId`    | The id of the object that was locked                                                     |
| `foreignType`  | The type of the object that was locked (eg. `bookComponent`)                             |
| `tabId`        | An auto-generated uuid that represents the specific tab that the lock was acquired from  |
| `userAgent`    | What type of browser the tab id belongs to                                               |
| `lastActiveAt` | A timestamp that shows the last time the lock websocket connection was found to be alive |

### Websocket server

On starting the app, a dedicated websocket server is started in parallel to the app’s main server. Each lock is represented by a socket connection of this websocket server.

### How a lock can be acquired

Acquiring a lock will happen when

- A user opens a document AND
- The user has the permissions for edit access AND
- There is no existing lock on the document

If the above conditions are met, a socket connection is opened. In the connection’s `onOpen` event (on the client), the lock mutation is triggered, which will do the actual locking of the document.

Other users who try to access the same document will then only be able to access it in read-only mode until the lock is released.

If the same user opens the same document in another tab or another window, they will be treated the same way another user is. In other words, the lock is acquired by a specific user, for a specific document, at a specific tab. A second tab from the same user will open the document in read-only mode, as the lock has already been acquired by a different combination of the above.

If the owner of the lock releases it, the socket connection is closed. If another user (or the same user in another tab) has the document open, one of them will acquire the lock on a first come - first served basis (given that they have the appropriate permissions). From an end user point of view, this means that if user A has the lock on a document and user B has the document open in read-only mode, user A releasing the lock will result in user B acquiring it automatically. Similarly, if user A has the lock on a document in one tab and has the same document open in read-only mode in a second tab, releasing the lock on the first tab will result in the second tab acquiring the lock.

### How a lock can be released

The lock can be released in one of the following ways:

**The user explicitly releases the lock**

- In v2, this means that the user clicks on the chapter title on the side bar while already having a lock for that chapter
- In v1, the user clicks on the “unlock” button in the book builder (admin, global production editor & lock owner only)
- In both scenarios, this is done by triggering the `UNLOCK_BOOK_COMPONENT` mutation (which will also trigger the appropriate subscriptions)

**The user implicitly releases the lock** (by navigating away from the page, closing the tab or closing the window)

- These scenarios will trigger the websocket `onClose` event on the server side
- This will delete the lock record from the database and trigger the appropriate subscriptions

**Through detecting a broken connection**

- As long as the socket connection is open, a heartbeat (ping/pong) event will be occurring between the server and the client.
- Each connection has an `isAlive` property stored on it, which tracks whether the connection is still there.
- Every 3 seconds (configurable), the server will ping the client
  - If the client responds, the connection is alive. This will patch the lock row with a timestamp, indicating the last time the socket connection was found to be alive.
  - If the client does not respond, the connection is considered broken. On detection of a broken connection, the lock record is deleted from the database and the appropriate subscriptions are triggered to let the clients know the lock is released.

**Through detecting expired locks**

- Every 7 seconds (configurable), query the locks table for “expired” locks, based on the lock’s timestamp
- If the timestamp is older than _the heartbeat interval + 0.3 seconds of padding_ from now, the lock is considered expired and is removed, and the appropriate subscriptions are triggered
- The padding exists to not run into issues where we’re checking a lock right when its heartbeat would be running
- This whole mechanism exists as a failsafe in case no previous mechanisms were triggered, as well as to cover events such as server crashes

**Through detecting an idle lock**

- This addresses the issue were a user might have left a tab open for prolonged periods of time, acquiring a lock and locking other users out of the chapter
- Every 10 minutes query the locks table. For a lock, if both (a) 1 day has passed since the last time the content was updated and (b) 30 minutes have passed since the lock was acquired, then it is released.
- The combination of the above makes sure that if you just acquired a lock a short while ago, but haven’t made changes yet, you’re not thrown out, but if you made changes a long while ago and still have the lock, you are thrown out.

### Broken connections user flow

The user flow for what happens on broken connections is described in detail in [this miro board](https://miro.com/app/board/uXjVNXGfOOo=/) (probably needs to be cleaned up at some point).

Some key takeaways:

- Two scenarios are described in this board. Scenario 1 is the one that is implemented.
- If the connection is lost, the lock is released and we show a modal that blocks the user from making more edits. This is done because since the lock is released, another user could have potentially acquired the lock and made edits, which could create conflicts on what the correct version of the document is at that point.
- If the connection is lost (and the lock is released), the client will keep retrying to acquire a new lock. For a user, this means that if the connection is restored and no other user has locked this document in the meantime, they will reacquire a lock on that document automatically.
- Between the connection actually being lost and the app actually detecting that this is the case, there is a window (of maybe a couple of seconds - configurable) where the user could have made changes that have not been saved. These changes will be lost.
