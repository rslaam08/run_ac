import { createSlice, PayloadAction } from '@reduxjs/toolkit';

interface AuthState {
  userSeq: number | null;
  name:    string | null;
}

const initialState: AuthState = { userSeq: null, name: null };

const authSlice = createSlice({
  name: 'auth',
  initialState,
  reducers: {
    setUser(state, action: PayloadAction<{ seq: number; name: string }>) {
      state.userSeq = action.payload.seq;
      state.name    = action.payload.name;
    }
  }
});

export const { setUser } = authSlice.actions;
export default authSlice.reducer;
