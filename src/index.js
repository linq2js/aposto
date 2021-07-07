import {
  createElement,
  useState as stateHook,
  useEffect as effectHook,
  useRef as refHook,
} from "react";
import {
  ApolloClient,
  InMemoryCache,
  ApolloProvider,
  useMutation as apolloMutationHook,
  useSubscription as apolloSubscriptionHook,
  useApolloClient as apolloClientHook,
  useQuery as apolloQueryHook,
  useLazyQuery as apolloLazyQueryHook,
  gql,
} from "@apollo/client";

let id = 1;
const EMPTY_OBJECT = {};
const EMPTY_ARRAY = [];
const NOOP = () => {};

const generateName = (prefix) => `${prefix}_${id++}`;

const createGqlBuilder =
  (type) =>
  (input, ...args) => {
    // is query variables
    if (!Array.isArray(input)) {
      return (strings, ...args) =>
        createGql(
          strings,
          args,
          type,
          Object.entries(input || EMPTY_OBJECT).map(
            ([name, type]) => `${name}:${type}`
          )
        );
    }
    return createGql(input, args, type, EMPTY_ARRAY);
  };

const createGql = (strings, args, type, variables) => {
  return Object.assign(
    gql(
      [
        `${type} ${generateName(type)}${
          variables.length ? ` (${variables.join(",")})` : ""
        } {`,
      ]
        .concat(strings)
        .concat("}"),
      ...[""].concat(args).concat("")
    ),
    {
      $$graphQLType: type,
    }
  );
};

const query = createGqlBuilder("query");
const mutation = createGqlBuilder("mutation");
const subscription = createGqlBuilder("subscription");
const createSubscriptionList = () => {
  const subscriptions = [];
  return {
    subscribe(subscription) {
      let unsubscribed = false;
      subscriptions.push(subscription);
      return () => {
        if (unsubscribed) return;
        unsubscribed = true;
        const index = subscriptions.indexOf(subscription);
        index !== -1 && subscriptions.splice(index, 1);
      };
    },
    get length() {
      return subscriptions.length;
    },
    notify() {
      const args = arguments;
      subscriptions.slice(0).forEach((subscription) => subscription(...args));
    },
  };
};
const createStore = ({
  state: initialState = EMPTY_OBJECT,
  init, // init saga
  onError: onErrorHandler,
  onDispatch: onDispatchHandler,
  ...options
} = EMPTY_OBJECT) => {
  let currentState = initialState || EMPTY_OBJECT;
  const runningSagas = new Set();
  const onChangeSubscriptions = createSubscriptionList();
  const onDispatchSubscriptions = createSubscriptionList();
  const onErrorSubscriptions = createSubscriptionList();
  const dispatchers = new Map();
  const dispatch = (action, payload) => {
    if (!payload || typeof payload !== "object") payload = EMPTY_OBJECT;
    onDispatchSubscriptions.notify({ action, payload });
  };
  const getState = () => currentState;
  const onChange = (subscription) =>
    onChangeSubscriptions.subscribe(subscription);
  const onDispatch = (subscription) =>
    onDispatchSubscriptions.subscribe(subscription);
  const onError = (subscription) =>
    onErrorSubscriptions.subscribe(subscription);
  const getDispatchers = (actions) =>
    actions.map((action) => {
      let dispatcher = dispatchers.get(action);
      if (!dispatcher) {
        dispatcher = (payload) => dispatch(action, payload);
        dispatchers.set(action, dispatcher);
      }
      return dispatcher;
    });
  const subscribe = (subscription) => {
    const unsubscribeOnChange = onChange((args) =>
      subscription({ ...args, type: "change" })
    );
    const unsubscribeOnDispatch = onDispatch((args) =>
      subscription({ ...args, type: "dispatch" })
    );
    return () => {
      unsubscribeOnChange();
      unsubscribeOnDispatch();
    };
  };
  const mergeState = (values) => {
    if (!values) return;
    if (typeof values === "function") values = values(currentState);
    let nextState = currentState;
    Object.keys(values).forEach((key) => {
      const value =
        typeof values[key] === "function"
          ? values[key](nextState[key])
          : values[key];
      // value change
      if (!(key in nextState) || nextState[key] !== value) {
        if (nextState === currentState) {
          nextState = { ...currentState };
        }
        nextState[key] = value;
      }
    });
    if (nextState !== currentState) {
      currentState = nextState;
      onChangeSubscriptions.notify(currentState);
    }
  };
  const $$onSagaError = (error) => {
    if (!error) return;
    if (onErrorSubscriptions.length) {
      return onErrorSubscriptions.notify(error);
    }
    throw error;
  };
  const $$runOnce = (sagas) => {
    sagas.forEach((saga) => {
      if (runningSagas.has(saga)) return;
      runningSagas.add(saga);
      runSaga(store, saga, undefined, undefined, $$onSagaError);
    });
  };
  const client = new ApolloClient({
    ...options,
    cache: new InMemoryCache(),
  });

  const store = {
    client,
    dispatch,
    getState,
    onChange,
    onDispatch,
    getDispatchers,
    mergeState,
    subscribe,
    onError,
    $$runOnce,
    $$onSagaError,
  };

  client.$$store = store;

  onErrorHandler && onErrorSubscriptions.subscribe(onErrorHandler);
  onDispatchHandler && onDispatchSubscriptions.subscribe(onDispatchHandler);

  initialState && store.mergeState(initialState);

  init && runSaga(store, init, undefined, $$onSagaError);

  return client;
};

const defaultErrorHandler = (e) => {
  if (!e) return;
  throw e;
};

const Provider = ({ store, children }) => {
  return createElement(ApolloProvider, {
    client: store,
    children,
  });
};

const storeHook = () => apolloClientHook().$$store;

const selectorHook = (variables) => {
  if (!variables) variables = EMPTY_OBJECT;
  const store = storeHook();
  const ref = refHook({}).current;
  const [current, update] = stateHook();
  ref.vars = variables;
  ref.update = update;
  ref.current = current;

  effectHook(() => {
    if (typeof ref.vars !== "function") return;

    function onUpdate() {
      ref.error = null;
      try {
        const next = ref.vars(store.getState());
        if (shallowEqual(next, ref.current)) {
          return;
        }
        ref.current = next;
        ref.isStateChanged = true;
        ref.update(next);
      } catch (e) {
        ref.error = e;
        ref.update({});
      }
    }

    onUpdate();

    return store.onChange(onUpdate);
  }, [store, ref]);

  if (ref.error) throw ref.error;
  if (typeof ref.vars !== "function") return variables;
  const isStateChanged = ref.isStateChanged;
  ref.isStateChanged = false;
  if (!ref.current || !isStateChanged) {
    ref.current = ref.vars(store.getState());
  }
  return ref.current;
};

const shallowEqual = (a, b) => {
  if (a === b) return true;
  if (a && typeof a === "object" && b && typeof b === "object") {
    for (const k in a) {
      if (a[k] !== b[k]) return false;
    }
    for (const k in b) {
      if (a[k] !== b[k]) return false;
    }
    return true;
  }
  return false;
};

const createLoadable = (initialValue) => {
  if (initialValue && initialValue.$$loadable) return initialValue;
  let promise;
  let error;
  let value;
  let status = null;

  function updateValue(nextValue) {
    if (nextValue && typeof nextValue.then === "function") {
      const p = (promise = nextValue.then(
        (x) => {
          if (p !== promise) return;
          value = x;
          error = undefined;
          status = "hasValue";
        },
        (x) => {
          if (p !== promise) return;
          error = x;
          value = undefined;
          status = "hasError";
        }
      ));
      error = undefined;
      value = undefined;
      status = "isLoading";
    } else if (nextValue instanceof Error) {
      promise = Promise.reject(nextValue);
      value = undefined;
      status = "hasError";
    } else {
      promise = Promise.resolve(nextValue);
      value = nextValue;
      status = "hasValue";
    }
  }

  updateValue(initialValue);

  return {
    $$loadable: true,
    get status() {
      return status;
    },
    get value() {
      if (status === "isLoading") throw promise;
      if (status === "hasError") throw error;
      return value;
    },
    get isLoading() {
      return status === "isLoading";
    },
    get hasError() {
      return status === "hasError";
    },
    get hasValue() {
      return status === "hasValue";
    },
  };
};

const useAction = (...args) => {
  const store = storeHook();
  if (typeof args[0] === "string") {
    return store.getDispatchers(args);
  }
  let [
    mutation,
    variables,
    { onCompleted, onError, ...options } = EMPTY_OBJECT,
  ] = args;
  variables = selectorHook(variables);
  const ref = refHook({}).current;
  const [mutate, result] = apolloMutationHook(mutation, {
    ...options,
    variables,
  });
  ref.result = result;
  ref.mutate = mutate;
  if (!ref.wrapper) {
    ref.mutateWrapper = (variables, options) => {
      if (typeof variables === "function") {
        variables = variables(store.getState());
      }
      return ref.mutate({ ...options, variables });
    };
    ref.wrapper = createDataProxy(ref);
  }

  return [ref.mutateWrapper, ref.wrapper];
};

const useQuery = (
  query,
  variables,
  {
    lazy,
    fetchPolicy,
    noCache,
    onError,
    onCompleted,
    mergeToState,
    dispatchAction,
    onSubscriptionData,
    ...options
  } = EMPTY_OBJECT
) => {
  if (typeof query === "string") {
    const prop = query;
    return selectorHook((state) => ({ value: state[prop] })).value;
  }
  if (typeof query === "function") return selectorHook(query);
  variables = selectorHook(variables);
  const store = storeHook();
  const ref = refHook({}).current;
  const isSubscription = query.$$graphQLType === "subscription";
  const queryResult = (
    isSubscription
      ? apolloSubscriptionHook
      : lazy
      ? apolloLazyQueryHook
      : apolloQueryHook
  )(query, {
    ...options,
    variables,
    fetchPolicy: noCache ? "no-cache" : fetchPolicy,
    ...(isSubscription
      ? {
          onSubscriptionData(options) {
            onSubscriptionData && onSubscriptionData(options);
            if (mergeToState) {
              ref.subscriptionData = options.subscriptionData.data;
              store.mergeState(
                mergeToState(
                  store.getState(),
                  options.subscriptionData.data,
                  options
                )
              );
            }
            if (dispatchAction) {
              dispatchAction(
                store.dispatch,
                options.subscriptionData.data,
                options
              );
            }
          },
        }
      : {
          onCompleted(data) {
            onCompleted && onCompleted(data);
            ref.resolve && ref.resolve(data);
          },
          onError(error) {
            onError && onError(error);
            ref.reject && ref.reject(error);
          },
        }),
  });
  if (lazy) {
    ref.result = queryResult[1];
    ref.result.execute = queryResult[0];
  } else {
    ref.result = queryResult;
  }

  if (!ref.wrapper) {
    ref.wrapper = createDataProxy(ref);
  }

  return ref.wrapper;
};

const createDataProxy = (ref) => {
  return new Proxy(EMPTY_OBJECT, {
    get(_, name) {
      if (name[0] === "$") {
        return ref.result[name.substr(1)];
      }

      if (ref.result.loading) {
        throw new Promise((resolve, reject) => {
          ref.resolve = resolve;
          ref.reject = reject;
        });
      }

      if (ref.result.error) {
        throw ref.result.error;
      }

      return ref.result.data && ref.result.data[name];
    },
  });
};

const createCancellationToken = (parent) => {
  let cancelled = false;
  return {
    get cancelled() {
      return cancelled && parent && parent.cancelled;
    },
    cancel() {
      cancelled = true;
    },
  };
};

const runSaga = (
  store,
  saga,
  payload,
  onDone = NOOP,
  onError = defaultErrorHandler,
  parentCT
) => {
  if (!store.$$sagaContext) {
    store.$$sagaContext = createSagaContext(store);
  }
  const childCT = createCancellationToken(parentCT);
  try {
    const iterator = saga(store.$$sagaContext, payload);
    if (iterator && typeof iterator.next === "function") {
      const next = (payload) => {
        try {
          if (childCT.cancelled) return;
          const { done, value } = iterator.next(payload);
          if (done) {
            return onDone(value);
          }
          return processExp(store, value, childCT, next, onError);
        } catch (e) {
          return onError(e);
        }
      };
      next();

      return childCT;
    }
    // is promise
    if (iterator && typeof iterator.then === "function") {
      return iterator.then(onDone, onError);
    }
    onDone(iterator);
  } catch (e) {
    onError(e);
  }
};

const isActionMatch = (pattern, action) =>
  Array.isArray(pattern)
    ? pattern.some((a) => a === "*" || a === action)
    : pattern === "*" || pattern === action;

const processExp = (
  store,
  exp,
  ct,
  onDone = NOOP,
  onError = defaultErrorHandler
) => {
  if (ct.cancelled) {
    return;
  }
  // is promise
  if (exp && !exp.$$expression && typeof exp.then === "function") {
    return exp.then((result) => {
      if (ct.cancelled) return;
      onDone(result);
    }, onError);
  }

  if (
    exp.type === "query" ||
    exp.type === "mutate" ||
    exp.type === "subscribe"
  ) {
    const result = store.client[exp.type](exp.options);
    if (result && typeof result.then === "function") {
      result.then(
        (x) => {
          if (ct.cancelled) return;
          onDone(exp.type === "query" || exp.type === "mutation" ? x.data : x);
        },
        (x) => {
          if (ct.cancelled) return;
          onError(x);
        }
      );
    }
    return;
  }

  if (exp.type === "when") {
    const whenCT = createCancellationToken(ct);
    let latestCT;
    let unsubscribed = false;
    let timestamp = 0;
    const execute = (e) => {
      latestCT = runSaga(
        store,
        exp.saga,
        typeof exp.payload === "function" ? exp.payload(e) : exp.payload || e,
        undefined,
        onError,
        ct
      );

      if (exp.once) {
        unsubscribed = true;
        unsubscribe && unsubscribe(``);
      }
    };

    const cancel = () => {
      unsubscribed = true;
      unsubscribe && unsubscribe();
      latestCT && latestCT.cancel();
    };

    const unsubscribe = store.onDispatch((e) => {
      if (unsubscribed) return;
      if (whenCT.cancelled) {
        return cancel();
      }
      if (!isActionMatch(exp.action, e.action)) {
        return;
      }
      if (exp.latest && latestCT) {
        latestCT.cancel();
      }
      if (exp.debounce || exp.throttle) {
        if (exp.debounce) {
          clearTimeout(timestamp);
          timestamp = setTimeout(() => execute(e), exp.debounce);
        } else {
          const now = new Date().getTime();
          if (now - timestamp >= exp.throttle) {
            timestamp = now;
            execute(e);
          }
        }
      } else {
        execute(e);
      }
    });
    return !exp.skipResult && onDone(whenCT);
  }

  if (exp.type === "call") {
    // call action
    if (typeof exp.action === "string") {
      store.dispatch(exp.action, exp.payload);
      return onDone();
    }
    // call saga
    if (typeof exp.action === "function") {
      return onDone(
        runSaga(store, exp.action, exp.payload, onDone, onError, ct)
      );
    }
    throw new Error(`Unsupported action type ${exp.action}`);
  }

  if (exp.type === "get") {
    if (!exp.name) {
      return onDone(store.getState());
    }
    return onDone(store.getState()[exp.name]);
  }

  if (exp.type === "merge") {
    store.mergeState(exp.values);
    return onDone();
  }

  if (exp.type === "fork") {
    return onDone(runSaga(store, exp.saga, exp.payload, null, onError, ct));
  }

  if (exp.type === "cancel") {
    const task = exp.task || ct;
    task && task.cancel && task.cancel();
    return;
  }

  if (exp.type === "delay") {
    setTimeout(() => {
      if (ct.cancelled) return;
      onDone(exp.value);
    });
    return;
  }

  if (exp.type === "all" || exp.type === "any") {
    let doneCount = 0;
    let done = false;
    const isAny = exp.type === "any";
    const onItemDone = (e, key) => {
      if (done || ct.cancelled) return;
      doneCount++;
      result[key] = e;
      if (isAny) {
        done = true;
        // cancel others
        tokens.forEach((x) => x.key !== key && x.token.cancel());
        onDone(result);
      } else if (doneCount === entries.length) {
        done = true;
        onDone(result);
      }
    };
    const onItemError = (e) => {
      // cancel all
      tokens.forEach((x) => x.token.cancel());
      onError(e);
    };
    const entries = Object.entries(exp.items);
    const result = Array.isArray(exp.items) ? [] : {};
    const tokens = entries.map(([key, item]) => {
      // shorthand for when exp
      if (typeof item === "string" || Array.isArray(item)) {
        item = {
          type: "when",
          action: item,
          once: true,
          skipResult: true,
          saga: (_, e) => onItemDone(e, key),
        };
      }
      const itemCT = createCancellationToken(ct);
      processExp(store, item, itemCT, (e) => onItemDone(e, key), onItemError);
      return { key, token: itemCT };
    });
    return;
  }

  throw new Error(`Unsupported yield expression ${exp.type}`);
};

const useSaga = (...sagas) => {
  const store = storeHook();
  effectHook(() => {
    store.$$runOnce(sagas);
  }, [store]);
};

const createSagaContext = (store) => {
  function createExp(type, props) {
    const exp = {
      $$expression: true,
      type,
      ...props,
      exec(onDone, onError, parentCT) {
        const ct = createCancellationToken(parentCT);
        processExp(store, exp, ct, onDone, onError);
        return ct;
      },
      then(onResolve, onReject) {
        return new Promise((resolve, reject) => exp.exec(resolve, reject)).then(
          onResolve,
          onReject
        );
      },
    };
    return exp;
  }

  return {
    when: (action, saga, options) =>
      createExp("when", {
        action,
        saga,
        ...options,
      }),
    call: (action, payload) => createExp("call", { action, payload }),
    query: (query, variables, options) =>
      createExp("query", { options: { query, variables, ...options } }),
    mutate: (mutation, variables, options) =>
      createExp("mutate", { options: { mutation, variables, ...options } }),
    subscribe: (subscription, variables, options) =>
      createExp("subscribe", {
        options: { subscription, variables, ...options },
      }),
    get: (name) => createExp("get", { name }),
    merge: (values) => createExp("merge", { values }),
    fork: (saga, payload) => createExp("fork", { saga, payload }),
    all: (items) => createExp("all", { items }),
    any: (items) => createExp("any", { items }),
    delay: (ms, value) => createExp("delay", { ms, value }),
    cancel: (task) => createExp("cancel", { task }),
  };
};

export {
  createStore,
  storeHook as useStore,
  createLoadable as loadable,
  Provider,
  gql,
  query,
  mutation,
  subscription,
  useQuery,
  useAction,
  useSaga,
  runSaga,
  createSagaContext,
};
