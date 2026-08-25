import { GoogleSignin } from "@react-native-google-signin/google-signin";
import { api } from "./axiosConfig";

export const AuthService = {

  // splash screen
  getSplash: async () => {
    const response = await api.get("splash-screen/");
    return response.data;
  },

    // login
  login: async (data: any) => {
    const response = await api.post("user/login", data);
    return response.data;
  },

    // register
  register: async (data: any) => {
    const response = await api.post("user/register", data);
    return response.data;
  },

   // OtpVrify
  otpVerify: async (data: any) => {
    const response = await api.post("user/verify-otp", data);
    return response.data;
  },

    // resendOtp
  resendOtp: async (data: any) => {
    const response = await api.post("user/resend-otp", data);
    return response.data;
  },

  //Privacy
  getPrivacydata:async () => {
    const response = await api.get("privacyPolicy");
    return response.data;
  },

  //Forgot with Mobile
  forgotPassword_with_mobile:async(data:any)=>{
    const response=await api.post('user/password-change',data);
    return response.data;
  },
  

  //Forgot with email
  forgotPassword_with_email:async(data:any)=>{
    const response=await api.post('user/forgot-password',data);
    return response.data;
  },

  // Forgot with Mobile Otp
  forgotPassword_with_mobile_verifyOtp:async(data:any)=>{
    const response=await api.post('user/password-otp',data);
    return response.data;
  },
 
  // Reset Password
  resetPassword:async(data:any)=>{
    const response=await api.post('user/password-reset',data);
    return response.data;
  },
  
  //Whitepaper download
  whitepaper_download:async(data:any)=>{
const response=await api.get('whitePaper/',data);
    return response.data;
  },

  // profile
  profile:async()=>{
    const response=await api.post('user/profile');
    return response.data;
  },

  //Update profile 
   update_profile:async(data:any)=>{
    const response=await api.post('user/profile-update',data);
    return response.data;
  },

  // timerico
  timerIco:async()=>{
    const response=await api.get('ico/');
    return response.data;
  },

    //Reward
  reward:async(data:any)=>{
      const response=await api.post('reward/',data);
    return response.data;
  },

  //rewardStatus 

 rewardStatus:async()=>{
      const response=await api.post('reward/status-check');
    return response.data;
  },

  //Changepassword
  changePassword:async(data: void)=>{
    const response=await api.post('user/change-password',data);
    return response.data;
  },

  //Faq
  faq:async(data: void)=>{
    const response=await api.get('faq/');
    return response.data;
  },

  //Terms
  terms:async(data: void)=>{
    const response=await api.get('terms/');
    return response.data;
  },

  //About
about:async(data: void)=>{
    const response=await api.get('about/');
    return response.data;
  },
getFcm:async(data:any)=>{
  const response =await api.post('user/get-fcm',data)
  return response.data
},
googlelogin:async(data:any)=>{
  const response =await api.get('auth/google',data)
  return response.data
},
facebooklogin:async(data:any)=>{
  const response =await api.get('auth/facebook',data)
  return response.data
},


};