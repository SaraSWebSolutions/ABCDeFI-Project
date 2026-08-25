
export const validateUsername = (username: string) => {
  if (!username) return "Username is required";

  if (username.length < 3)
    return "Username must be at least 3 characters";

  return "";
};


export const validateMobile = (mobile: string) => {
  if (!mobile) return "Mobile number is required";

  const phoneRegex = /^[0-9]{10}$/;

  if (!phoneRegex.test(mobile))
    return "Enter a valid 10 digit mobile number";

  return "";
};


export const validateEmailOrPhone = (value: string) => {

  if (!value) return "Email or phone is required";

  const emailRegex =
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  const phoneRegex =
    /^[0-9]{10,15}$/;

  if (!emailRegex.test(value) && !phoneRegex.test(value)) {
    return "Invalid email or phone number";
  }

  return "";
};


export const validatePassword = (password: string) => {

  if (!password) return "Password required";

  if (password.length < 6)
    return "Password must be at least 6 characters";

  return "";
};


export const validateConfirmPassword = (
  password: string,
  confirmPassword: string
) => {

  if (!confirmPassword)
    return "Confirm password required";

  if (password !== confirmPassword)
    return "Passwords do not match";

  return "";
};


export const validateDropdown = (
  value: string,
  field: string
) => {

  if (!value) return `Please select ${field}`;

  return "";
};


export const validateTerms = (agree: boolean) => {

  if (!agree)
    return "You must accept Terms & Privacy Policy";

  return "";
};