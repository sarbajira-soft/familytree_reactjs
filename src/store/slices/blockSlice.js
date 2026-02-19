import { createAsyncThunk, createSlice } from '@reduxjs/toolkit';
import {
  blockUser as blockUserRequest,
  unblockUser as unblockUserRequest,
  getBlockedUsers,
  getBlockStatus,
} from '../../services/block.service';

const DEFAULT_STATUS = {
  isBlockedByMe: false,
  isBlockedByThem: false,
};

/** BLOCK OVERRIDE: Async thunk for blocking users. */
export const blockUser = createAsyncThunk('block/blockUser', async (userId) => {
  const response = await blockUserRequest(userId);
  return {
    userId: Number(userId),
    response,
  };
});

/** BLOCK OVERRIDE: Async thunk for unblocking users. */
export const unblockUser = createAsyncThunk('block/unblockUser', async (userId) => {
  await unblockUserRequest(userId);
  return Number(userId);
});

/** BLOCK OVERRIDE: Async thunk for fetching blocked users list. */
export const fetchBlockedUsers = createAsyncThunk('block/fetchBlockedUsers', async () => {
  const response = await getBlockedUsers();
  return response?.data || [];
});

/** BLOCK OVERRIDE: Async thunk for fetching directional status for one user. */
export const fetchBlockStatus = createAsyncThunk('block/fetchBlockStatus', async (userId) => {
  const response = await getBlockStatus(userId);
  return {
    userId: Number(userId),
    status: response?.data || DEFAULT_STATUS,
  };
});

const initialState = {
  blockedUsers: [],
  blockStatus: {},
  loading: false,
  error: null,
};

/** BLOCK OVERRIDE: New block state slice replacing legacy block state contracts. */
const blockSlice = createSlice({
  name: 'block',
  initialState,
  reducers: {
    setBlockStatus(state, action) {
      const { userId, status } = action.payload;
      state.blockStatus[userId] = status || DEFAULT_STATUS;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(blockUser.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(blockUser.fulfilled, (state, action) => {
        const userId = action.payload.userId;
        state.loading = false;
        state.blockStatus[userId] = { ...DEFAULT_STATUS, isBlockedByMe: true };
      })
      .addCase(blockUser.rejected, (state, action) => {
        state.loading = false;
        state.error = action.error?.message || 'Failed to block user';
      })
      .addCase(unblockUser.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(unblockUser.fulfilled, (state, action) => {
        const userId = action.payload;
        state.loading = false;
        state.blockStatus[userId] = DEFAULT_STATUS;
        state.blockedUsers = state.blockedUsers.filter(
          (row) => Number(row.blockedUserId) !== Number(userId),
        );
      })
      .addCase(unblockUser.rejected, (state, action) => {
        state.loading = false;
        state.error = action.error?.message || 'Failed to unblock user';
      })
      .addCase(fetchBlockedUsers.fulfilled, (state, action) => {
        state.blockedUsers = action.payload;
      })
      .addCase(fetchBlockStatus.fulfilled, (state, action) => {
        state.blockStatus[action.payload.userId] = action.payload.status;
      });
  },
});

export const { setBlockStatus } = blockSlice.actions;
export default blockSlice.reducer;
