/* eslint-disable no-unused-vars,@typescript-eslint/no-unused-vars */
import { ApolloLink, HttpOptions } from "@apollo/client";
import { WebSocketLink } from "@apollo/client/link/ws";
import { SubscriptionClient } from "subscriptions-transport-ws/dist/client";

export interface CreateLinkFn extends Function {
  (
    http: string | HttpOptions,
    ws: string | WebSocketLink.Configuration | SubscriptionClient
  ): ApolloLink;
}

export const createLink: CreateLinkFn;
