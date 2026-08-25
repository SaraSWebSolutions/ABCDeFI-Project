import { createSlice, createAsyncThunk } from "@reduxjs/toolkit";
import { AuthService } from "../../Services/authService";
import { showLoader, hideLoader } from "./loaderSlice";

// 🔥 API CALL
export const fetchTimerIco = createAsyncThunk(
  "home/fetchTimerIco",
  async (_, { rejectWithValue,dispatch }) => {
    try {
            dispatch(showLoader()); //  start loader

      const response = await AuthService.timerIco();
      return response.data;
    } catch (err: any) {
            dispatch(hideLoader()); //  start loader

      return rejectWithValue(err?.response?.data || "Something went wrong");
    }finally {
      dispatch(hideLoader()); //  stop loader
    }
  }
);

//reward
export const fetchReward = createAsyncThunk(
  "home/fetchReward",
  async (data: any, { rejectWithValue,dispatch }) => {
    try {
      dispatch(showLoader())
      const response = await AuthService.reward(data)
console.log(response);

      return response.data;
    } catch (err: any) {
      return rejectWithValue(err?.response?.data || "Something went wrong");
    }finally {
      dispatch(hideLoader()); //  stop loader
    }
  }
);

// homeSlice.ts / homeSlice.js

export const fetchRewardStatus = createAsyncThunk(
  "home/fetchRewardStatus",
  async (_, { rejectWithValue ,dispatch}) => {
    try {
      dispatch(showLoader())
      
      const response = await AuthService.rewardStatus();
      return response;
    } catch (err: any) {
      return rejectWithValue(
        err?.response?.data || "Failed to fetch reward status"
      );
    }finally {
      dispatch(hideLoader()); //  stop loader
    }
  }
);

// 🧠 SLICE
const homeSlice = createSlice({
  name: "home",
  initialState: {
    timerIcoData: null,
    loading: false,
    error: null,
    rewardData: null,
     rewardStatus: null,
  },
  reducers: {},

  extraReducers: (builder) => {
    builder
      // ⏳ LOADING
      .addCase(fetchTimerIco.pending, (state) => {
        state.loading = true;
        state.error = null;
      })

      // SUCCESS
      .addCase(fetchTimerIco.fulfilled, (state, action) => {
        state.loading = false;
        state.timerIcoData = action.payload;
      })

      // ERROR
      .addCase(fetchTimerIco.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      })

      .addCase(fetchReward.pending, (state) => {
        state.loading = true;
      })
      .addCase(fetchReward.fulfilled, (state, action) => {
         state.loading = false;
        state.rewardData = action.payload;

        state.rewardStatus = true;
      })
      .addCase(fetchReward.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      })
      //  REWARD STATUS
      .addCase(fetchRewardStatus.pending, (state) => {
        state.loading = true;
      })
      .addCase(fetchRewardStatus.fulfilled, (state, action) => {
        // console.log(action.payload,"action.payload");
        
        state.loading = false;
          state.rewardData = action.payload;

        state.rewardStatus = action.payload?.data;
      })
      .addCase(fetchRewardStatus.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      });

      
  },
});

export default homeSlice.reducer;