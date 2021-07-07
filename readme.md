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

function* InitSaga({ when }) {
  yield when(INCREASE, OnIncreaseSaga);
}

function* OnIncreaseSaga({ merge }) {
  yield merge({
    [COUNT_STATE]: (prev) => prev + 1,
  });
}

const store = createStore({
  state: { [COUNT_STATE]: 0 },
  init: InitSaga,
});

const App = () => {
  const count = useQuery(COUNT_STATE);
  const [increase] = useAction(INCREASE_ACTION);

  return (
    <>
      <h1>{count}</h1>
      <button onClick={increase}>Increase</button>
    </>
  );
};

render(
  <Provider store={store}>
    <App />
  </Provider>
);
```
