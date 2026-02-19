import { combineReducers } from '@reduxjs/toolkit';
import blockReducer from './slices/blockSlice';

// BLOCK OVERRIDE: New root reducer registration for block slice replacement.
const rootReducer = combineReducers({
  block: blockReducer,
});

export default rootReducer;
