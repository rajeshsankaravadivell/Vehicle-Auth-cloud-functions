import * as functions from "firebase-functions";
import * as admin from "firebase-admin";

admin.initializeApp();

export const manageUsers = functions.https.onCall(async (data, context) => {
  debugger;
  // Check if request is authenticated
  if (!context.auth) {
    throw new functions.https.HttpsError(
      "unauthenticated",

      "The function must be called while authenticated."
    );
  }
  // Verify the user has an admin role
  const callerUid = context.auth.uid;
  const callerToken = await admin.auth().getUser(callerUid);
  if (callerToken.customClaims?.role !== "ADMIN") {
    throw new functions.https.HttpsError(
      "permission-denied",
      "Only admins can invoke this function."
    );
  }
  // Operations: create, edit, delete, disable
  const operation = data.operation;
  const userDetail = data.userDetails;
  const userRecord = {
    email: userDetail.email,
    emailVerified: userDetail.emailVerified,
    phoneNumber: userDetail.phoneNumber,
    password: userDetail.password,
    displayName: userDetail.displayName,
    photoURL: userDetail.photoURL,
    disabled: userDetail.disabled,
  };

  try {
    switch (operation) {
      case "create":
        const firebaseUser = await admin
          .auth()
          .createUser(userRecord)
          .catch((error) => {
            throw new functions.https.HttpsError(
              "invalid-argument",
              error.message
            );
          });
        admin
          .auth()
          .setCustomUserClaims(firebaseUser.uid, { role: userDetail.role });
        userDetail.uid = firebaseUser.uid;
        await admin
          .firestore()
          .collection("users")
          .doc(firebaseUser.uid)
          .set(data);

        return {
          result: `User created successfully with UID: ${firebaseUser.uid}`,
        };
      case "edit":
        const updatedUserRecord = await admin
          .auth()
          .updateUser(userDetail.uid, userDetail);
        admin.auth().setCustomUserClaims(updatedUserRecord.uid, {
          role: userDetail.role,
        });
        await admin
          .firestore()
          .collection("users")
          .doc(updatedUserRecord.uid)
          .set(data);
        return {
          result: `User ${updatedUserRecord.uid} updated successfully.`,
        };
      case "delete":
        await admin.auth().deleteUser(userDetail.uid);
        await admin
          .firestore()
          .collection("users")
          .doc(userDetail.uid)
          .delete();
        return { result: `User ${userDetail.uid} deleted successfully.` };
      case "disable":
        const disabledUserRecord = await admin
          .auth()
          .updateUser(userDetail.uid, { disabled: userDetail.disabled });
        await admin
          .firestore()
          .collection("users")
          .doc(disabledUserRecord.uid)
          .set(data);
        return {
          result: `User ${disabledUserRecord.uid} disabled successfully.`,
        };
      case "enable":
        const enableUserRecord = await admin
          .auth()
          .updateUser(userDetail.uid, { disabled: false });
        await admin
          .firestore()
          .collection("users")
          .doc(enableUserRecord.uid)
          .set(data);
        return { result: `User ${enableUserRecord.uid} enabled successfully.` };
      default:
        throw new functions.https.HttpsError(
          "invalid-argument",
          "The function must be called with a valid operation parameter."
        );
    }
  } catch (error) {
    console.error("Error managing user:", error);
    throw new functions.https.HttpsError(
      data.operation,

      "Failed to perform the requested operation.",
      error
    );
  }
});
