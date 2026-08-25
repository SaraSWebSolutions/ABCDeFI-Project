import { createSlice, createAsyncThunk, PayloadAction } from "@reduxjs/toolkit";
import { AuthService } from "../../Services/authService";
import { hideLoader,showLoader } from "./loaderSlice";
// ============================
// 🔹 Types
// ============================

export interface User {
  _id: string;
  name: string;
  email: string;
  mobileNumber: number;
  gender?: string;
  country?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface ProfileResponse {
  success: boolean;
  data: User;
}

export interface UpdateProfilePayload {
  name: string;
  email: string;
  mobileNumber: string | number;
  country?: string;
  gender?: string;
}

interface ProfileState {
  loading: boolean;
  profileData: User | null;
  updateLoading: boolean;
  error: string | null;
  successMessage: string | null;
}

// ============================
// 🔹 Initial State
// ============================

const initialState: ProfileState = {
  loading: false,
  profileData: null,
  updateLoading: false,
  error: null,
  successMessage: null,
};

// ============================
// 🔹 Async Thunks
// ============================

// Get Profile
export const fetchProfile = createAsyncThunk<
  User,
  void,
  { rejectValue: string }
>("profile/fetchProfile", async (_, { rejectWithValue ,dispatch}) => {
  try {
    dispatch(showLoader())
    const response: ProfileResponse = await AuthService.profile();
    return response.data; // only user object
  } catch (error: any) {
    return rejectWithValue(
      error?.response?.data?.message || "Something went wrong"
    );
  }finally {
      dispatch(hideLoader()); //  stop loader
    }
});

// Update Profile
export const updateProfile = createAsyncThunk<
  User,
  UpdateProfilePayload,
  { rejectValue: string }
>("profile/updateProfile", async (formData, { rejectWithValue,dispatch }) => {
  try {
    dispatch(showLoader())
    const response: ProfileResponse =
      await AuthService.update_profile(formData);
    return response.data;
  } catch (error: any) {
    return rejectWithValue(
      error?.response?.data?.message || "Something went wrong"
    );
  }finally {
      dispatch(hideLoader()); //  stop loader
    }
});

// ============================
// 🔹 Slice
// ============================

const profileSlice = createSlice({
  name: "profile",
  initialState,
  reducers: {
    clearProfileState: (state) => {
      state.error = null;
      state.successMessage = null;
    },
  },
  extraReducers: (builder) => {
    builder

      // ========================
      // Fetch Profile
      // ========================
      .addCase(fetchProfile.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(
        fetchProfile.fulfilled,
        (state, action: PayloadAction<User>) => {
          state.loading = false;
          console.log(action.payload,'action.payload');
          
          state.profileData = action.payload;
        }
      )
      .addCase(fetchProfile.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload || "Error fetching profile";
      })

      // ========================
      // Update Profile
      // ========================
      .addCase(updateProfile.pending, (state) => {
        state.updateLoading = true;
        state.error = null;
        state.successMessage = null;
      })
      .addCase(
        updateProfile.fulfilled,
        (state, action: PayloadAction<User>) => {
          state.updateLoading = false;
          state.successMessage = "Profile updated successfully";
          state.profileData = action.payload;
        }
      )
      .addCase(updateProfile.rejected, (state, action) => {
        state.updateLoading = false;
        state.error = action.payload || "Error updating profile";
      });
  },
});

// ============================
// 🔹 Exports
// ============================

export const { clearProfileState } = profileSlice.actions;
export default profileSlice.reducer;