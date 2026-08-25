import { createSlice, createAsyncThunk } from "@reduxjs/toolkit";
import { AuthService } from "../../Services/authService";
import { showLoader, hideLoader } from "./loaderSlice";

interface SplashState {
  loading: boolean;
  data: any;
  error: string | null;
}

const initialState: SplashState = {
  loading: false,
  data: null,
  error: null,
};

export const fetchSplash = createAsyncThunk(
  "splash/fetchSplash",
  async (_, thunkAPI) => {
    try {
      thunkAPI.dispatch(showLoader());

      const response = await AuthService.getSplash();

      return response;
    } catch (error: any) {
      return thunkAPI.rejectWithValue(error.message);
    } finally {
      thunkAPI.dispatch(hideLoader());
    }
  }
);
const splashSlice = createSlice({
  name: "splash",
  initialState,
  reducers: {},
  extraReducers: builder => {
    builder
      .addCase(fetchSplash.pending, state => {
        state.loading = true;
      })
      .addCase(fetchSplash.fulfilled, (state, action) => {
        state.loading = false;
        state.data = action.payload;
      })
      .addCase(fetchSplash.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload as string;
      });
  },
});

export default splashSlice.reducer;