/* eslint-disable no-unused-vars,@typescript-eslint/no-unused-vars */
import * as React from "react";
import {
  ApolloClientOptions,
  ApolloError,
  DataProxy,
  ErrorPolicy,
  FetchPolicy,
  FetchResult,
  InMemoryCache,
  MutationOptions,
  MutationResult,
  Observer,
  OnSubscriptionDataOptions,
  QueryOptions,
  SubscriptionOptions,
} from "@apollo/client";

export interface StoreOptions<T> extends ApolloClientOptions<InMemoryCache> {
  state?: T;
  init?: SagaFn;
  onChange?: EventHandler<T>;
  onDispatch?: EventHandler<OnDispatchArgs>;
}

export type EventHandler<TArgs> = (args: TArgs) => void;

export type Unsubscribe = () => void;

export interface WhenOptions {
  latest?: boolean;
  once?: boolean;
  payload?: any;
  debounce?: number;
  throttle?: number;
}

export interface Cancellable {
  readonly cancelled: boolean;
  cancel(): void;
}

export interface SagaContext<TState> {
  when(
    action: string | string[],
    saga: SagaFn,
    options?: WhenOptions
  ): Task<Cancellable>;
  call(action: string, payload?: any): Task;
  call(saga: SagaFn, payload?: any): Task;
  get(): Task<TState>;
  get<T = any>(prop: string): Task<T>;
  merge(
    values:
      | Partial<TState>
      | { [key in keyof TState]: (prev: TState[key]) => TState[key] }
  ): Task;
  fork(saga: SagaFn, payload?: any): Task;
  all<
    TValues extends {
      [key: string]: string | string[] | Task;
    }
  >(
    values: TValues
  ): Task<{ [key in keyof TValues]: any }>;
  all(values: (string | string[] | Task)[]): Task<any[]>;
  any<
    TValues extends {
      [key: string]: string | string[] | Task;
    }
  >(
    values: TValues
  ): Task<{ [key in keyof TValues]: any }>;
  any(values: (string | string[] | Task)[]): Task<any[]>;
  delay<T>(ms?: number, value?: T): Task<T>;
  cancel(task?: Task): Task;
  mutate(
    mutation: GraphQLMutation,
    variables?: { [key: string]: any },
    options?: MutationOptions
  ): Task;
  query(
    query: GraphQLQuery,
    variables?: { [key: string]: any },
    options?: QueryOptions
  ): Task;
  subscribe(
    subscription: GraphQLSubscription,
    variables?: { [key: string]: any },
    options?: SubscriptionOptions
  ): Task<Cancellable>;
}

export interface Task<T = any> extends Promise<T> {}

export interface SagaFn<TState = any, TPayload = any, TResult = any>
  extends Function {
  (context: SagaContext<TState>, payload?: TPayload): TResult;
}

export interface OnDispatchArgs {
  action: string;
  payload: any;
}

export interface Store<TState> {
  getState(): TState;
  dispatch(action: string, payload: any): void;
  onError(handler: EventHandler<Error>): Unsubscribe;
  onChange(handler: EventHandler<TState>): Unsubscribe;
  onDispatch(handler: EventHandler<OnDispatchArgs>): Unsubscribe;
}

export interface UseSagaFn extends Function {}

export interface CreateStoreFn extends Function {
  <T>(options: StoreOptions<T>): Store<T>;
}

export interface UseStoreFn extends Function {
  (): Store<any>;
}

export interface LoadableFn extends Function {
  <T>(value: T): LoadableInfer<T>;
}

export interface Loadable<T> extends Promise<T> {
  readonly status: "hasError" | "hasValue" | "isLoading";
  readonly isLoading: boolean;
  readonly hasError: boolean;
  readonly hasValue: boolean;
  readonly error: any;
  readonly value: T;
}

export type LoadableInfer<T> = T extends Promise<infer TValue>
  ? Loadable<TValue>
  : T extends Error
  ? Loadable<any>
  : Loadable<T>;

export interface GraphQLObject {}

export interface GraphQLQuery extends GraphQLObject {}

export interface GraphQLMutation extends GraphQLObject {}

export interface GraphQLSubscription extends GraphQLObject {}

export interface GQLFn<T extends GraphQLObject = GraphQLObject>
  extends Function {
  (literals: string[], ...args: any[]): T;
  (variables: { [key: string]: string }): (
    literals: string[],
    ...args: any[]
  ) => T;
}

export interface GraphQLQueryResult<T> {
  $data: T;
  $previousData: T;
  $error: any;
  $called: boolean;
  $loading: boolean;
  $refetch: Function;
  $fetchMore: Function;
  $startPolling: Function;
  $stopPolling: Function;
  $subscribeToMore: Function;
  $updateQuery: Function;
}

export interface GraphQLLazyQueryResult<T> extends GraphQLQueryResult<T> {
  $execute: Function;
}

export interface GraphQLMutationOptions<T> {
  variables?: Variables;
  update?: (cache: DataProxy, mutationResult: MutationResult) => any;
  ignoreResults?: boolean;
  optimisticResponse?: boolean;
  refetchQueries?:
    | Array<string | { query: GraphQLQuery; variables?: any }>
    | ((
        mutationResult: FetchResult
      ) => Array<string | { query: GraphQLQuery; variables?: any }>);
  awaitRefetchQueries?: boolean;
  onCompleted?: EventHandler<any>;
  onError?: EventHandler<ApolloError>;
}

export interface GraphQLMutationResult<T> {
  $data: T;
  $loading: boolean;
  $error: ApolloError;
  $called: boolean;
}

export type ActionDispatcher = (action: string, payload?: any) => void;

export interface UseActionFn extends Function {
  <T>(
    mutation: GraphQLMutation,
    variables?: Variables,
    options?: GraphQLMutationOptions<T>
  ): [Function, GraphQLMutationResult<T> & T];
  (...actions: string[]): ActionDispatcher[];
}

export interface GraphQLLazyQueryOptions<T> extends GraphQLQueryOptions<T> {
  lazy: true;
}

export type VariablesResolver = (state: any) => { [key: string]: any };

export interface GraphQLQueryOptions<T> {
  noCache?: boolean;
  variables?: Variables;
  errorPolicy?: ErrorPolicy;
  onCompleted?: EventHandler<any>;
  onError?: EventHandler<ApolloError>;
  skip?: boolean;
  displayName?: string;
  pollInterval?: number;
  notifyOnNetworkStatusChange?: boolean;
  ssr?: boolean;
  fetchPolicy?: FetchPolicy;
  nextFetchPolicy?: FetchPolicy;
  returnPartialData?: boolean;
}

export type Variables = { [key: string]: any } | VariablesResolver;

export interface GraphQLSubscriptionOptions<T> {
  variables?: Variables;
  shouldResubscribe?: boolean;
  skip?: boolean;
  onSubscriptionData?: EventHandler<OnSubscriptionDataOptions<T>>;
  fetchPolicy?: FetchPolicy;
  mergeToState?: (state: any, data: T) => any;
  dispatchAction?: (dispatch: ActionDispatcher, data: T) => any;
}

export interface GraphQLSubscriptionResult<T> {
  $data: T;
  $loading: boolean;
  $error: ApolloError;
}

export interface UseQueryFn extends Function {
  <T = any>(stateProp: string): T;
  <T extends { [key: string]: any }, TState = any>(
    stateQuery: (state: TState) => T
  ): T;
  <T>(
    graphQLQuery: GraphQLQuery,
    variables?: Variables,
    options?: GraphQLLazyQueryOptions<T>
  ): GraphQLLazyQueryResult<T> & T;
  <T>(
    graphQLQuery: GraphQLQuery,
    variables?: Variables,
    options?: GraphQLQueryOptions<T>
  ): GraphQLQueryResult<T> & T;
  <T>(
    graphQLSubscription: GraphQLSubscription,
    variables?: Variables,
    options?: GraphQLSubscriptionOptions<T>
  ): GraphQLSubscriptionResult<T> & T;
}

// export const gql: GQLFn;

export const query: GQLFn<GraphQLQuery>;

export const mutation: GQLFn<GraphQLMutation>;

export const subscription: GQLFn<GraphQLSubscription>;

export const useStore: UseStoreFn;

export const useAction: UseActionFn;

export const useQuery: UseQueryFn;

export const loadable: LoadableFn;

export const createStore: CreateStoreFn;

export const useSaga: UseSagaFn;

export const Provider: React.FC<{
  store: Store<any>;
}>;
