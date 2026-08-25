import { createSlice, createAsyncThunk } from "@reduxjs/toolkit";
import { api } from "../../Services/axiosConfig";
import { showLoader, hideLoader } from "./loaderSlice";
import { AuthService } from "../../Services/authService";

//  FAQ API
export const getFaq = createAsyncThunk(
  "content/getFaq",
  async (_: void, { rejectWithValue, dispatch }) => {
    try {
      dispatch(showLoader());

      const response = await AuthService.faq();
// console.log(response.data);

      return response.data;

    } catch (error: any) {
      return rejectWithValue(
        error?.response?.data || "Failed to fetch FAQ"
      );
    } finally {
      dispatch(hideLoader());
    }
  }
);

//  TERMS API
export const getTerms = createAsyncThunk(
  "content/getTerms",
  async (_: void, { rejectWithValue, dispatch }) => {
    try {
      dispatch(showLoader());

      const response = await AuthService.terms();

      return response.data;

    } catch (error: any) {
      return rejectWithValue(
        error?.response?.data || "Failed to fetch Terms"
      );
    } finally {
      dispatch(hideLoader());
    }
  }
);

//  about API
export const getAbout = createAsyncThunk(
  "content/getabout",
  async (_: void, { rejectWithValue, dispatch }) => {
    try {
      dispatch(showLoader());

      const response = await AuthService.about();

      return response.data;

    } catch (error: any) {
      return rejectWithValue(
        error?.response?.data || "Failed to fetch Terms"
      );
    } finally {
      dispatch(hideLoader());
    }
  }
);
//  INITIAL STATE
const initialState = {
  faq: null as any,
  terms: null as any,
  about:null as any,
  loading: false,
  error: null as any,
};

//  SLICE
const contentSlice = createSlice({
  name: "content",
  initialState,
  reducers: {},

  extraReducers: (builder) => {
    builder

      // FAQ
      .addCase(getFaq.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(getFaq.fulfilled, (state, action) => {
        state.loading = false;
        state.faq = action.payload;
      })
      .addCase(getFaq.rejected, (state, action: any) => {
        state.loading = false;
        state.error = action.payload;
      })

      // TERMS
      .addCase(getTerms.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(getTerms.fulfilled, (state, action) => {
        state.loading = false;
        state.terms = action.payload;
      })
      .addCase(getTerms.rejected, (state, action: any) => {
        state.loading = false;
        state.error = action.payload;
      })
       // TERMS
      .addCase(getAbout.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(getAbout.fulfilled, (state, action) => {
        state.loading = false;
        
        state.about = action.payload;
      })
      .addCase(getAbout.rejected, (state, action: any) => {
        state.loading = false;
        state.error = action.payload;
      });

  },
});

export default contentSlice.reducer;