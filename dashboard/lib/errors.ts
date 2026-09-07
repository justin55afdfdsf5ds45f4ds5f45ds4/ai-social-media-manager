/** Errors that map to 4xx responses. Anything else is a 500. */
export class UserError extends Error {
  name = "UserError";
}

export class NotFoundError extends Error {
  name = "NotFoundError";
}
