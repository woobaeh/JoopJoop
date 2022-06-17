const router = require("express").Router();
const passport = require("passport");
const CLIENT_URL = "http://localhost:3000/";
const User = require("../models/user");
const CryptoJS = require("crypto-js");
const {
  generateAccessToken,
  generateRefreshToken,
  generateOauthToken,
} = require("./tokenfunction");
const jwt = require("jsonwebtoken");

const cookieOption = {
  httpOnly: true,
  sameSite: "none",
  secure: true,
  domain: "localhost",
};

//REGISTER
router.post("/signup", async (req, res) => {
  const newUser = new User({
    nickname: req.body.nickname,
    email: req.body.email,
    password: CryptoJS.AES.encrypt(
      req.body.password,
      process.env.PASS_SEC
    ).toString(),
  });

  const user = await User.find();
  if (!user.filter((el) => (el.nickname === newUser.nickname ? false : true))) {
    return res.status(401).json({
      message: "중복되는 닉네임이 있습니다. 다른 닉네임을 사용해주세요",
    });
  }

  try {
    const savedUser = await newUser.save();
    res.status(201).json({
      message: `${savedUser.email}.You successfully registered as a JoopJoop member`,
    });
  } catch (err) {
    res.status(500).json(err);
  }
});

//LOGIN
router.post("/login", async (req, res) => {
  try {
    const user = await User.findOne({
      email: req.body.email,
    });

    if (!user) {
      return res.status(401).json({ message: "등록되지않은 이메일입니다." });
    }

    const hashedPassword = CryptoJS.AES.decrypt(
      user.password,
      process.env.PASS_SEC
    );

    const originalPassword = hashedPassword.toString(CryptoJS.enc.Utf8);
    const inputPassword = req.body.password;
    // console.log(`original :" ${originalPassword} input :" ${inputPassword}`);

    if (originalPassword != inputPassword) {
      return res.status(401).json({ message: "패스워드를 다시 확인해주세요." });
    }

    const accessToken = generateAccessToken(user);
    const refreshToken = generateRefreshToken(user);

    const { password, ...others } = user._doc;
    res
      .cookie("refreshToken", refreshToken, cookieOption)
      .status(200)
      .json({ ...others, accessToken });
  } catch (err) {
    console.log(err);
    res.status(500).json(err);
  }
});

//GUEST LOGIN
router.post("/guest-login", async (req, res) => {
  try {
    const user = await User.findOne({
      email: req.body.email,
    });
    console.log(user);
    if (!user) {
      return res.status(401).json("등록되지않은 이메일입니다.");
    }

    const accessToken = generateAccessToken(user);
    const refreshToken = generateRefreshToken(user);
    const { password, ...others } = user._doc;

    res
      .cookie("refreshToken", refreshToken, cookieOption)
      .status(200)
      .json({ ...others, accessToken });
  } catch (err) {
    console.log(err);
    res.status(500).json(err);
  }
});

//Refresh Login
router.post("/refresh", async (req, res) => {
  // console.log('리프레쉬');
  const refreshToken = req.cookies.refreshToken;

  if (!refreshToken) {
    return res.status(400).json({ message: "refresh token이 없습니다" });
  }
  const checkRefreshToken = (refreshToken) => {
    return jwt.verify(
      refreshToken,
      process.env.REFRESH_SECRET,
      (err, decoded) => {
        if (err) {
          console.log(err);
          return null;
        }
        return decoded;
      }
    );
  };

  const refreshTokenData = checkRefreshToken(refreshToken);

  if (!refreshTokenData) {
    return res.json({
      message: "유효하지않은 refresh token 입니다. 다시 로그인하세요.",
    });
  }

  const { id } = refreshTokenData;
  const user = await User.findOne({ _id: id });

  try {
    const newAccessToken = generateAccessToken(user);
    const { password, ...others } = user._doc;
    res.status(200).json({ ...others, accessToken: newAccessToken });
  } catch (err) {
    return res.status(400).json({
      message: "refresh token과 일치하는 유저가 없습니다.",
    });
  }
});

// Oauth2 Kakao Login
router.post("/kakao", (req, res) => {
  if (req.body.data.oAuthId) {
    //요청 body에 oAuthId 키가 존재하는지 체크한다.
    //만일 존재한다면, DB에 해당 oAuthId를 갖고있는 유저를 탐색한다.
    User.findOne({ oAuthId: req.body.data.oAuthId }, async (err, user) => {
      if (!user) {
        const userSchema = await new User(req.body.data);
        // 계정 생성
        await userSchema.save((err) => {
          if (err) return res.json({ success: false, err });
          return res.status(200).json({
            registerSuccess: true,
          });
        });
      }
      //JWT 토큰 발급
      const accessToken = generateOauthToken(user);
      res
        .cookie("x_auth", accessToken, cookieOption)
        .status(200)
        .json({ loginSuccess: true, userId: user._id });
    });
    return;
  }
});
// router.get('/google/login/success', (req, res) => {
//   if (req.user) {
//     res.status(200).json({
//       success: true,
//       message: 'successfull',
//       user: req.user,
//       //   cookies: req.cookies
//     });
//   }
// });

// Oauth2 Goggle Login
router.get(
  "/google",
  passport.authenticate("google", { scope: ["profile", "email"] })
);

// router.get(
//   '/google/callback',
//   passport.authenticate('google', {
//     successRedirect: 'login/success',
//     failureRedirect: CLIENT_URL,
//   })
// );
router.get(
  "/google/callback",

  passport.authenticate("google", {
    failureRedirect: CLIENT_URL,
  }),
  async function (req, res) {
    const { oAuthId, nickname, isAdmin } = req.user._doc;
    // Successful authentication, redirect home.\
    const userGoogle = await User.findOne({ oAuthId });
    console.log(userGoogle);

    const refreshToken = generateRefreshToken(userGoogle);
    // const accessToken = jwt.sign(
    //   { userId: userGoogle._doc.oAuthId },
    //   process.env.JWT_SEC
    // );
    // res.cookie('refreshToken', token);
    // res.status(200).json(accessToken);
    res
      .cookie("refreshToken", refreshToken, cookieOption)
      .status(200)
      .redirect(CLIENT_URL);
  }
);

router.get("/logout", (req, res) => {
  try {
    res.clearCookie("refreshToken");
    res.clearCookie("x_auth");
    // res.redirect('/');
    return res.status(200).json({ message: "로그아웃에 성공했습니다" });
  } catch (err) {
    res.status(500).json(err);
  }
});
module.exports = router;
