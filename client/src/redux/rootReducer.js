const initialState = {
  isLogin: false,
  searchTown: [],
  searchDate: "",
  searchTime: [],
  email: "test@gmail.com",
  nickname: "팅팅",
};

const rootReducer = (state = initialState, action) => {
  switch (action.type) {
    case "SET_DOGS":
      return { ...state, dogData: action.payload };
    case "SET_ISLOGIN":
      return { ...state, isLogin: action.payload };
    case "SET_SEARCHTOWN":
      return { ...state, searchTown: action.payload };
    case "SET_SEARCHDATE":
      return { ...state, searchDate: action.payload };
    case "SET_SEARCHTIME":
      return { ...state, searchTime: action.payload };
    case "SET_EMAIL":
      return { ...state, setEmail: action.payload };
    case "SET_NICKNAME":
      return { ...state, setNickname: action.payload };
    default:
      return state;
  }
};

export default rootReducer;
