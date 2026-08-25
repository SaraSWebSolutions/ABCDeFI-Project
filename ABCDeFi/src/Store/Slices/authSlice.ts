import { createSlice, createAsyncThunk } from "@reduxjs/toolkit";
import { AuthService } from "../../Services/authService";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { api } from "../../Services/axiosConfig";
import { showLoader, hideLoader } from "./loaderSlice";

//  LOGIN THUNK
export const loginUser = createAsyncThunk(
  "auth/loginUser",
  async (data: any, { rejectWithValue, dispatch }) => {
    try {
      dispatch(showLoader()); //  start loader

      const response = await AuthService.login(data);

      const token = response?.token;
      

      if (token) {
        await AsyncStorage.setItem("token", token);
        api.defaults.headers.Authorization = `Bearer ${token}`;
      }

      return response;

    } catch (error: any) {
      return rejectWithValue(
        error?.response || "Login failed"
      );
    } finally {
      dispatch(hideLoader()); //  stop loader
    }
  }
);
export const logoutUser = createAsyncThunk(
  "auth/logoutUser",
  async (_, { dispatch }) => {
    dispatch(showLoader());

    await AsyncStorage.removeItem("token");

    // ❗ clear axios header
    delete api.defaults.headers.Authorization;

    dispatch(hideLoader());

    return true;
  }
);

//  REGISTER
export const registerUser = createAsyncThunk(
  "auth/registerUser",
  async (data: any, { rejectWithValue, dispatch }) => {
    try {
      dispatch(showLoader());

      const response = await AuthService.register(data);

      // const token = response?.data?.token;

      // //  if API returns token after register
      // if (token) {
      //   await AsyncStorage.setItem("token", token);
      //   api.defaults.headers.Authorization = `Bearer ${token}`;
      // }

      return response;

    } catch (error: any) {
      return rejectWithValue(
        error?.response?.data || "Registration failed"
      );
    } finally {
      dispatch(hideLoader());
    }
  }
);

//  VERIFY OTP
export const verifyOtp = createAsyncThunk(
  "auth/verifyOtp",
  async (data: any, { rejectWithValue, dispatch }) => {
    try {
      dispatch(showLoader());

      const response = await AuthService.otpVerify(data);
// console.log('response',response);

      const token = response?.token;

       //save token after OTP verify (important)
      if (token) {
        await AsyncStorage.setItem("token", token);
        api.defaults.headers.Authorization = `Bearer ${token}`;
      }

      return response;

    } catch (error: any) {
      return rejectWithValue(
        error?.response?.data || "OTP verification failed"
      );
    } finally {
      dispatch(hideLoader());
    }
  }
);

//RESEND OTP
export const resendOtp = createAsyncThunk(
  "auth/resendOtp",
  async (data: any, { rejectWithValue, dispatch }) => {
    try {
      dispatch(showLoader());

      const response = await AuthService.resendOtp(data);

      return response;

    } catch (error: any) {
      return rejectWithValue(
        error?.response?.data || "Resend OTP failed"
      );
    } finally {
      dispatch(hideLoader());
    }
  }
);

//Privacy
export const getPrivacy = createAsyncThunk(
  "auth/getPrivacy",
  async (_, { rejectWithValue, dispatch }) => {
    try {
      dispatch(showLoader());

      const response = await AuthService.getPrivacydata();

      return response.data;

    } catch (error: any) {
      return rejectWithValue(
        error?.response?.data || "Failed to fetch privacy policy"
      );
    } finally {
setTimeout(() => {
  dispatch(hideLoader());
}, 3000);    }
  }
);


// FORGOT PASSWORD (MOBILE)
export const forgotPasswordMobile = createAsyncThunk(
  "auth/forgotPasswordMobile",
  async (data: any, { rejectWithValue, dispatch }) => {
    try {
      dispatch(showLoader());

      const response = await AuthService.forgotPassword_with_mobile(data);

      return response; //  FIXED

    } catch (err: any) {
      return rejectWithValue(err?.response?.data || "Error");
    } finally {
      dispatch(hideLoader());
    }
  }
);

// VERIFY OTP (FORGOT)
export const verifyForgotOtp = createAsyncThunk(
  "auth/verifyForgotOtp",
  async (data: any, { rejectWithValue, dispatch }) => {
    try {
      dispatch(showLoader());

      const response = await AuthService.forgotPassword_with_mobile_verifyOtp(data);

      return response; //  FIXED

    } catch (err: any) {
      return rejectWithValue(err?.response?.data || "Error");
    } finally {
      dispatch(hideLoader());
    }
  }
);

// RESET PASSWORD
export const resetPassword = createAsyncThunk(
  "auth/resetPassword",
  async (data: any, { rejectWithValue, dispatch }) => {
    try {
      dispatch(showLoader());

      const response = await AuthService.resetPassword(data); //  FIXED NAME

      return response;

    } catch (err: any) {
      return rejectWithValue(err?.response?.data || "Error");
    } finally {
      dispatch(hideLoader());
    }
  }
);

export const changePassword = createAsyncThunk(
  "auth/changePassword",
  async (data: any, { rejectWithValue, dispatch }) => {
    try {
      dispatch(showLoader());

      const response = await AuthService.changePassword(data);

      return response?.data;

    } catch (error: any) {
      return rejectWithValue(
        error?.response?.data || "Change password failed"
      );
    } finally {
      dispatch(hideLoader());
    }
  }
);

//whitePaper_download
export const downloadWhitepaper = createAsyncThunk(
  "auth/downloadWhitepaper",
  async (data: any, { rejectWithValue, dispatch }) => {
    try {
      dispatch(showLoader());

      const response = await AuthService.whitepaper_download(data);

      return response;

    } catch (error: any) {
      return rejectWithValue(
        error?.response?.data || "Whitepaper download failed"
      );
    } finally {
      dispatch(hideLoader());
    }
  }
);

export const forgotPasswordEmail = createAsyncThunk(
  "auth/forgotPasswordEmail",
  async (data: any, { rejectWithValue, dispatch }) => {
    try {
      dispatch(showLoader());

      const response = await AuthService.forgotPassword_with_email(data);

      return response;

    } catch (err: any) {
      return rejectWithValue(
        err?.response?.data || "Forgot password (email) failed"
      );
    } finally {
      dispatch(hideLoader());
    }
  }
);
//  INITIAL STATE
const initialState = {
  user: null,
  token: null,
  loading: false,
  error: null,
  otpVerified: false,
  resendSuccess: false,
    privacy: null,  
    forgotData: null as any,
    otpVerified_forgot: false,
    resetSuccess: false, 
  
  whitepaperData: null as any,
  whitepaperSuccess: false,  
  changePasswordSuccess: false,  
  forgotEmailData: null as any,
forgotEmailSuccess: false,   
};


//  SLICE
const authSlice = createSlice({
  name: "auth",
  initialState,
  reducers: {},

 extraReducers: (builder) => {
  builder

    //  LOGIN
    .addCase(loginUser.pending, (state) => {
      state.loading = true;
      state.error = null;
    })
    .addCase(loginUser.fulfilled, (state, action) => {
      state.loading = false;
      state.user = action.payload?.user || action.payload;
      state.token = action.payload?.token;
    })
    .addCase(loginUser.rejected, (state, action: any) => {
      state.loading = false;
      state.error = action.payload;
    })

    // REGISTER
    .addCase(registerUser.pending, (state) => {
      state.loading = true;
      state.error = null;
    })
    .addCase(registerUser.fulfilled, (state, action) => {
      state.loading = false;

      // some APIs return user only, some return token also
      state.user = action.payload?.user || action.payload;
      state.token = action.payload?.token || null;
    })
    .addCase(registerUser.rejected, (state, action: any) => {
      state.loading = false;
      state.error = action.payload;
    })

    //  LOGOUT
    .addCase(logoutUser.fulfilled, (state) => {
      state.user = null;
      state.token = null;
      state.error = null;
    })
    //  VERIFY OTP
.addCase(verifyOtp.pending, (state) => {
  state.loading = true;
  state.error = null;
})
.addCase(verifyOtp.fulfilled, (state, action) => {
  state.loading = false;
  state.otpVerified = true;
console.log(action.payload,"action.payloadaction.payload");

  state.user = action.payload?.data || action.payload;
  state.token = action.payload?.token;
})
.addCase(verifyOtp.rejected, (state, action: any) => {
  state.loading = false;
  state.error = action.payload;
  state.otpVerified = false;
})

//  RESEND OTP
.addCase(resendOtp.pending, (state) => {
  state.loading = true;
  state.error = null;
  state.resendSuccess = false;
})
.addCase(resendOtp.fulfilled, (state) => {
  state.loading = false;
  state.resendSuccess = true;
})
.addCase(resendOtp.rejected, (state, action: any) => {
  state.loading = false;
  state.error = action.payload;
  state.resendSuccess = false;
})
// 🔐 PRIVACY POLICY
.addCase(getPrivacy.pending, (state) => {
  state.loading = true;
  state.error = null;
})
.addCase(getPrivacy.fulfilled, (state, action) => {
  state.loading = false;
  state.privacy = action.payload;
})
.addCase(getPrivacy.rejected, (state, action: any) => {
  state.loading = false;
  state.error = action.payload;
})

// Forgot with mobile
.addCase(forgotPasswordMobile.pending, (state) => {
  state.loading = true;
  state.error = null;
})
.addCase(forgotPasswordMobile.fulfilled, (state, action) => {
  state.loading = false;
  state.forgotData = action.payload;
})
.addCase(forgotPasswordMobile.rejected, (state, action: any) => {
  state.loading = false;
  state.error = action.payload;
})

// VERIFY OTP (FORGOT)
.addCase(verifyForgotOtp.pending, (state) => {
  state.loading = true;
  state.error = null;
})
.addCase(verifyForgotOtp.fulfilled, (state) => {
  state.loading = false;
  state.otpVerified_forgot = true; //  FIXED
})
.addCase(verifyForgotOtp.rejected, (state, action: any) => {
  state.loading = false;
  state.error = action.payload;
  state.otpVerified_forgot = false;
})

// RESET PASSWORD
.addCase(resetPassword.pending, (state) => {
  state.loading = true;
  state.error = null;
})
.addCase(resetPassword.fulfilled, (state) => {
  state.loading = false;
  state.resetSuccess = true;
})
.addCase(resetPassword.rejected, (state, action: any) => {
  state.loading = false;
  state.error = action.payload;
  state.resetSuccess = false;
})
// WHITEPAPER DOWNLOAD
.addCase(downloadWhitepaper.pending, (state) => {
  state.loading = true;
  state.error = null;
  state.whitepaperSuccess = false;
})
.addCase(downloadWhitepaper.fulfilled, (state, action) => {
  state.loading = false;
  state.whitepaperData = action.payload;
  state.whitepaperSuccess = true;
})
.addCase(downloadWhitepaper.rejected, (state, action: any) => {
  state.loading = false;
  state.error = action.payload;
  state.whitepaperSuccess = false;
})
// CHANGE PASSWORD
.addCase(changePassword.pending, (state) => {
  state.loading = true;
  state.error = null;
})
.addCase(changePassword.fulfilled, (state, action) => {
  state.loading = false;
  state.changePasswordSuccess = true
})
.addCase(changePassword.rejected, (state, action: any) => {
  state.loading = false;
  state.changePasswordSuccess = false
})
// FORGOT PASSWORD (EMAIL)
.addCase(forgotPasswordEmail.pending, (state) => {
  state.loading = true;
  state.error = null;
  state.forgotEmailSuccess = false;
})
.addCase(forgotPasswordEmail.fulfilled, (state, action) => {
  state.loading = false;
  state.forgotEmailData = action.payload;
  state.forgotEmailSuccess = true;
})
.addCase(forgotPasswordEmail.rejected, (state, action: any) => {
  state.loading = false;
  state.error = action.payload;
  state.forgotEmailSuccess = false;
})
}
});

export default authSlice.reducer;