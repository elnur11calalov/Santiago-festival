/* Firebase + Google Sign-In. Yalnız public Firebase konfiqurasiyası buradadır. */
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-app.js";
import {
  getAuth,
  GoogleAuthProvider,
  onAuthStateChanged,
  signInWithPopup,
  signOut,
} from "https://www.gstatic.com/firebasejs/10.14.1/firebase-auth.js";
import {
  getFirestore,
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
} from "https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyAGU9jDxcVpOEs9ZCEl4beaOZ6ns_TfucU",
  authDomain: "santiago-festival.firebaseapp.com",
  projectId: "santiago-festival",
  storageBucket: "santiago-festival.firebasestorage.app",
  messagingSenderId: "243013162366",
  appId: "1:243013162366:web:64c04cac44e47016324f2f",
};
// Yeni host əlavə etmək üçün e-poçtu bu siyahıya kiçik hərflərlə yazın.
const HOST_EMAILS = [
  "elnur11calalov@gmail.com",
  "Arustmov0@gmail.com"
];
const $ = (s) => document.querySelector(s);
const icons = ["📚", "🌿", "✨", "☕", "🌻", "🎈", "🦋", "🌙", "🎉", "🧡"];
const esc = (x) =>
  String(x ?? "").replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ],
  );
const say = (target, text, ok = false) =>
  ($(target).innerHTML = text
    ? `<div class="message ${ok ? "ok" : ""}">${text}</div>`
    : "");
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
let user = null;
let activeGroup = null;
let selectedIcon = icons[0];
let stopGroupList = () => {};
let stopRoom = () => {};
let stopHost = () => {};
let stopDetails = () => {};

function isHost() {
  return HOST_EMAILS.includes(user?.email?.toLowerCase());
}
function renderIcons() {
  $("#emojis").innerHTML = icons
    .map(
      (x) =>
        `<button type="button" class="emoji ${x === selectedIcon ? "selected" : ""}" data-icon="${x}">${x}</button>`,
    )
    .join("");
}
function tab(id) {
  document
    .querySelectorAll(".page")
    .forEach((x) => x.classList.toggle("active", x.id === id));
  document
    .querySelectorAll(".tabbtn")
    .forEach((x) => x.classList.toggle("active", x.dataset.tab === id));
  window.scrollTo({ top: 0, behavior: "smooth" });
}
function showApp(loggedIn) {
  $("#login").classList.toggle("hidden", loggedIn);
  $("#app").classList.toggle("hidden", !loggedIn);
  $("#nav").classList.toggle("hidden", !loggedIn);
}
function showRoom(group) {
  stopRoom();
  activeGroup = group;
  $("#groupName").textContent = group.name;
  $("#roomTitle").textContent = group.name;
  $("#roomCode").textContent = group.code;
  const stopInvites = onSnapshot(
    query(
      collection(db, "groups", group.id, "invites"),
      where("volunteerId", "==", user.uid),
    ),
    (snap) => {
      const invites = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      $("#count").textContent = invites.length;
      $("#invites").innerHTML =
        invites
          .map(
            (x) =>
              `<div class="item row"><span><b>${x.icon} ${esc(x.firstName)} ${esc(x.lastName)}</b><div class="meta">+994 ${esc(x.phone)} · ${esc(x.note || "")}</div></span><button class="btn secondary small" data-delete="${x.id}">Sil</button></div>`,
          )
          .join("") || '<span class="muted">Hələ dəvət yoxdur.</span>';
    },
  );
  const stopScores = onSnapshot(
    query(
      collection(db, "groups", group.id, "stats"),
      orderBy("count", "desc"),
    ),
    (snap) => {
      $("#leaderboard").innerHTML =
        snap.docs
          .map((d, i) => {
            const x = d.data();
            return `<div class="item"><b class="rank">${["🥇", "🥈", "🥉"][i] || `${i + 1}.`}</b><span style="flex:1">${esc(x.displayName)}</span><b>${x.count}</b></div>`;
          })
          .join("") || '<span class="muted">Hələ statistika yoxdur.</span>';
    },
  );
  const stopMessages = onSnapshot(
    query(
      collection(db, "groups", group.id, "messages"),
      orderBy("createdAt", "asc"),
    ),
    (snap) => {
      $("#messages").innerHTML =
        snap.docs
          .map((d) => {
            const x = d.data();
            return `<div class="bubble ${x.senderId === user.uid ? "me" : ""}"><b>${esc(x.senderName)}</b>${esc(x.text)}</div>`;
          })
          .join("") || '<p class="muted">İlk mesajı siz yazın.</p>';
    },
  );
  stopRoom = () => {
    stopInvites();
    stopScores();
    stopMessages();
  };
  tab("inv");
}
async function renderMyGroups() {
  stopGroupList();
  stopGroupList = onSnapshot(
    collection(db, "users", user.uid, "groups"),
    async (snap) => {
      const records = await Promise.all(
        snap.docs.map(async (d) => {
          const group = await getDoc(doc(db, "groups", d.id));
          return group.exists() && group.data().active !== false
            ? { id: d.id, ...group.data() }
            : null;
        }),
      );
      const groups = records.filter(Boolean);
      $("#groupsList").innerHTML =
        groups
          .map(
            (x) =>
              `<div class="item row"><span><b>${esc(x.name)}</b><div class="meta">Kod: ${esc(x.code)}</div></span><button class="btn secondary small" data-group="${x.id}">Aç</button></div>`,
          )
          .join("") ||
        '<span class="muted">Hələ qrup yoxdur. Hostdan kod alın.</span>';
    },
  );
}
function openHost() {
  $("#hostDenied").classList.toggle("hidden", isHost());
  $("#hostContent").classList.toggle("hidden", !isHost());
  stopHost();
  if (!isHost()) return;
  stopHost = onSnapshot(
    query(collection(db, "groups"), orderBy("createdAt", "desc")),
    (snap) => {
      $("#hostGroups").innerHTML =
        snap.docs
          .filter((d) => d.data().active !== false)
          .map((d) => {
            const x = d.data();
            return `<div class="item row"><span><b>${esc(x.name)}</b><div class="meta">Kod: ${esc(x.code)}</div></span><span><button class="btn secondary small" data-details="${d.id}">Bax</button> <button class="btn secondary small" data-remove="${d.id}">Sil</button></span></div>`;
          })
          .join("") || '<span class="muted">Hələ qrup yoxdur.</span>';
    },
  );
}
function openDetails(id) {
  stopDetails();
  $("#groupDetails").classList.remove("hidden");
  getDoc(doc(db, "groups", id)).then(
    (d) => ($("#detailsName").textContent = d.data()?.name || "Qrup"),
  );
  const members = onSnapshot(
    collection(db, "groups", id, "members"),
    (snap) =>
      ($("#detailsMembers").innerHTML =
        `<span class="muted">Üzvlər: ${snap.size}</span>` +
        snap.docs
          .map((d) => `<div class="item">${esc(d.data().displayName)}</div>`)
          .join("")),
  );
  const invites = onSnapshot(
    query(
      collection(db, "groups", id, "invites"),
      orderBy("createdAt", "desc"),
    ),
    (snap) =>
      ($("#detailsInvites").innerHTML =
        snap.docs
          .map((d) => {
            const x = d.data();
            return `<div class="item">${x.icon} <span><b>${esc(x.firstName)} ${esc(x.lastName)}</b><div class="meta">+994 ${esc(x.phone)} · dəvət edən: ${esc(x.volunteerName)}</div></span></div>`;
          })
          .join("") || '<span class="muted">Hələ dəvət yoxdur.</span>'),
  );
  const messages = onSnapshot(
    query(
      collection(db, "groups", id, "messages"),
      orderBy("createdAt", "asc"),
    ),
    (snap) =>
      ($("#detailsMessages").innerHTML =
        snap.docs
          .map((d) => {
            const x = d.data();
            return `<div class="item"><b>${esc(x.senderName)}:</b>&nbsp;${esc(x.text)}</div>`;
          })
          .join("") || '<span class="muted">Hələ mesaj yoxdur.</span>'),
  );
  stopDetails = () => {
    members();
    invites();
    messages();
  };
}

$("#enter").onclick = () =>
  signInWithPopup(auth, new GoogleAuthProvider()).catch((e) =>
    say("#loginMessage", esc(e.message)),
  );
$("#logout").onclick = () => signOut(auth);
$("#nav").onclick = (e) => {
  if (e.target.dataset.tab) {
    tab(e.target.dataset.tab);
    if (e.target.dataset.tab === "host") openHost();
  }
};
$("#emojis").onclick = (e) => {
  if (e.target.dataset.icon) {
    selectedIcon = e.target.dataset.icon;
    renderIcons();
  }
};
$("#inviteForm").onsubmit = async (e) => {
  e.preventDefault();
  if (!activeGroup)
    return say("#inviteMessage", "Əvvəlcə Qruplar bölməsindən qrupa qoşulun.");
  const phone = $("#phone").value.replace(/\D/g, "").slice(-9);
  if (phone.length !== 9)
    return say("#inviteMessage", "Telefonun son 9 rəqəmini yazın.");
  const inviteRef = doc(db, "groups", activeGroup.id, "invites", phone);
  try {
    // Firestore qaydası yalnız öz dəvətlərini oxumağa icazə verir.
    // Buna görə əvvəlcədən getDoc() ilə yoxlama etmirik: yeni sənəd birbaşa yaradılır.
    await setDoc(inviteRef, {
      firstName: $("#firstName").value.trim(),
      lastName: $("#lastName").value.trim(),
      phone,
      note: $("#note").value.trim(),
      icon: selectedIcon,
      volunteerId: user.uid,
      volunteerName: user.displayName || "Könüllü",
      createdAt: serverTimestamp(),
    });
  } catch (error) {
    if (error.code === "permission-denied")
      return say("#inviteMessage", "Bu nömrə artıq əlavə olunub.");
    return say("#inviteMessage", "Dəvət əlavə edilərkən xəta baş verdi.");
  }
  const stat = doc(db, "groups", activeGroup.id, "stats", user.uid);
  const old = await getDoc(stat);
  await setDoc(
    stat,
    {
      displayName: user.displayName || "Könüllü",
      count: (old.data()?.count || 0) + 1,
    },
    { merge: true },
  );
  e.target.reset();
  say("#inviteMessage", "Dəvət əlavə edildi.", true);
};
$("#invites").onclick = async (e) => {
  const id = e.target.dataset.delete;
  if (!id || !activeGroup) return;
  await deleteDoc(doc(db, "groups", activeGroup.id, "invites", id));
  const stat = doc(db, "groups", activeGroup.id, "stats", user.uid),
    old = await getDoc(stat);
  await updateDoc(stat, { count: Math.max(0, (old.data()?.count || 1) - 1) });
};
$("#joinGroup").onclick = async () => {
  const code = $("#newGroupName").value.trim().toUpperCase();
  if (!code) return;
  const codeDoc = await getDoc(doc(db, "groupCodes", code));
  if (!codeDoc.exists())
    return say("#groupJoinMessage", "Qrup kodu tapılmadı.");
  const groupDoc = await getDoc(doc(db, "groups", codeDoc.data().groupId));
  if (!groupDoc.exists() || groupDoc.data().active === false)
    return say("#groupJoinMessage", "Bu qrup artıq aktiv deyil.");
  const group = { id: groupDoc.id, ...groupDoc.data() };
  await setDoc(
    doc(db, "groups", group.id, "members", user.uid),
    {
      displayName: user.displayName || "Könüllü",
      email: user.email || "",
      joinedAt: serverTimestamp(),
    },
    { merge: true },
  );
  await setDoc(
    doc(db, "groups", group.id, "stats", user.uid),
    { displayName: user.displayName || "Könüllü", count: 0 },
    { merge: true },
  );
  await setDoc(doc(db, "users", user.uid, "groups", group.id), {
    joinedAt: serverTimestamp(),
  });
  $("#newGroupName").value = "";
  say("#groupJoinMessage", "Qrupa qoşuldunuz.", true);
  showRoom(group);
};
$("#createGroup").onclick = async () => {
  const name = $("#hostGroupName").value.trim();
  if (!name) return say("#hostMessage", "Qrup adını yazın.");
  const code = crypto
      .randomUUID()
      .replaceAll("-", "")
      .slice(0, 6)
      .toUpperCase(),
    ref = doc(collection(db, "groups"));
  await setDoc(ref, {
    name,
    code,
    active: true,
    createdAt: serverTimestamp(),
    createdBy: user.uid,
  });
  await setDoc(doc(db, "groupCodes", code), { groupId: ref.id });
  $("#hostGroupName").value = "";
  say("#hostMessage", `Qrup yaradıldı. Kod: <b>${code}</b>`, true);
};
$("#hostGroups").onclick = async (e) => {
  if (e.target.dataset.details) return openDetails(e.target.dataset.details);
  const id = e.target.dataset.remove;
  if (!id) return;
  const group = await getDoc(doc(db, "groups", id));
  const groupName = group.data()?.name || "bu qrup";
  const confirmed = window.confirm(
    `“${groupName}” qrupunu silmək istədiyinizə əminsiniz? Qrup kodu dərhal işləməyəcək.`,
  );
  if (!confirmed) return;
  await updateDoc(doc(db, "groups", id), { active: false });
  await deleteDoc(doc(db, "groupCodes", group.data().code));
  if (activeGroup?.id === id) {
    activeGroup = null;
    stopRoom();
    $("#invites").innerHTML = '<span class="muted">Qrup seçilməyib.</span>';
  }
};
$("#groupsList").onclick = async (e) => {
  const id = e.target.dataset.group;
  if (!id) return;
  const d = await getDoc(doc(db, "groups", id));
  if (d.exists()) showRoom({ id: d.id, ...d.data() });
};
$("#leaderTab").onclick = () => {
  $("#leaderboard").classList.remove("hidden");
  $("#chatBox").classList.add("hidden");
  $("#leaderTab").classList.add("active");
  $("#chatTab").classList.remove("active");
};
$("#chatTab").onclick = () => {
  $("#leaderboard").classList.add("hidden");
  $("#chatBox").classList.remove("hidden");
  $("#chatTab").classList.add("active");
  $("#leaderTab").classList.remove("active");
};
$("#messageForm").onsubmit = async (e) => {
  e.preventDefault();
  const text = $("#messageText").value.trim();
  if (!text || !activeGroup) return;
  await addDoc(collection(db, "groups", activeGroup.id, "messages"), {
    text,
    senderId: user.uid,
    senderName: user.displayName || "Könüllü",
    createdAt: serverTimestamp(),
  });
  e.target.reset();
};
onAuthStateChanged(auth, (x) => {
  user = x;
  stopGroupList();
  stopRoom();
  stopHost();
  stopDetails();
  activeGroup = null;
  showApp(!!x);
  if (x) {
    renderIcons();
    renderMyGroups();
  }
});
