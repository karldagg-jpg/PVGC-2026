import firebase from "firebase/compat/app";
import "firebase/compat/firestore";
import { SEASON_YEAR } from "../constants/league";

const firebaseConfig = {
  apiKey: "AIzaSyA0ubEbHoYbfCSjfNxHUkt_fr_6WMb3t5Y",
  authDomain: "pvgc-league.firebaseapp.com",
  projectId: "pvgc-league",
  storageBucket: "pvgc-league.firebasestorage.app",
  messagingSenderId: "731595471102",
  appId: "1:731595471102:web:d4ad8bf15746bab7874daf",
};

if (!firebase.apps.length) {
  firebase.initializeApp(firebaseConfig);
}

const db = firebase.firestore();
const LEAGUE_DOC_ID = `league-${SEASON_YEAR}`;
const LEAGUE_DOC = db.collection("pvgc").doc(LEAGUE_DOC_ID);

const WEEK_SCORES_COL = LEAGUE_DOC.collection("weekScores");

export { firebase, db, LEAGUE_DOC, LEAGUE_DOC_ID, WEEK_SCORES_COL };
