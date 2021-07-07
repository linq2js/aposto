# aposto

A local state management for Apollo GraphQL

## Installation

**Using npm**

```
    npm i aposto --save
```

**Using yarn**

```
    yarn add aposto
```

## Counter App

```jsx
import React from "react";
import { render } from "react-dom";
import { createStore, Provider, useQuery, useAction } from "aposto";

const COUNT_STATE = "count";
const INCREASE_ACTION = "increase";
const INCREASE_ASYNC_ACTION = "increase-async";

// this saga will be triggered in initializing phase of the store
function* InitSaga({ when }) {
  // wait for INCREASE_ACTION and then call OnIncreaseSaga
  yield when(INCREASE_ACTION, OnIncreaseSaga);
  // wait for INCREASE_ACTION and then call OnIncreaseSaga with specified payload
  yield when(INCREASE_ASYNC_ACTION, OnIncreaseSaga, {
    payload: { async: true },
  });
}

function* OnIncreaseSaga({ merge, delay }, { async }) {
  if (async) {
    // delay in 1s then do next action
    yield delay(1000);
  }
  // merge specified piece of state to the whole state
  yield merge({
    // can pass state value or state reducer which retrieves previous state value as first param and return next state
    [COUNT_STATE]: (prev) => prev + 1,
  });
}

const store = createStore({
  // set initial state for the store
  state: { [COUNT_STATE]: 0 },
  init: InitSaga,
});

const App = () => {
  // select COUNT_STATE from the store state
  const count = useQuery(COUNT_STATE);
  // retrieve action disspatchers
  const [increase, increaseAsync] = useAction(
    INCREASE_ACTION,
    INCREASE_ASYNC_ACTION
  );

  return (
    <>
      <h1>{count}</h1>
      <button onClick={increase}>Increase</button>
      <button onClick={increaseAsync}>Increase Async</button>
    </>
  );
};

render(
  <Provider store={store}>
    <App />
  </Provider>,
  document.getElementById("root")
);
```
