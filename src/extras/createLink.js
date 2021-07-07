import { HttpLink, split } from "@apollo/client";
import { getMainDefinition } from "@apollo/client/utilities";
import { WebSocketLink } from "@apollo/client/link/ws";

const createLink = (http = {}, ws = {}) => {
  if (typeof http === "string") {
    http = { uri: http };
  }
  if (typeof ws === "string") {
    ws = { uri: ws };
  }
  const httpLink = new HttpLink({
    ...http,
  });

  const wsLink = new WebSocketLink({
    ...ws,
    options: {
      reconnect: true,
      ...ws.options,
    },
  });

  // The split function takes three parameters:
  //
  // * A function that's called for each operation to execute
  // * The Link to use for an operation if the function returns a "truthy" value
  // * The Link to use for an operation if the function returns a "falsy" value
  return split(
    ({ query }) => {
      const definition = getMainDefinition(query);
      return (
        definition.kind === "OperationDefinition" &&
        definition.operation === "subscription"
      );
    },
    wsLink,
    httpLink
  );
};

export default createLink;
