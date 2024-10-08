import { initializeApp } from "firebase/app";
import { getFirestore, collection, getDocs, query, where, addDoc, getDoc, doc, setDoc } from "firebase/firestore";
import { getAuth, GoogleAuthProvider, onAuthStateChanged, signInWithPopup, signOut } from "firebase/auth";
import { getDownloadURL, getStorage, ref, uploadBytes } from "firebase/storage";
import { useEffect, useState } from "react";

const firebaseConfig = {
    apiKey: import.meta.env.FIREBASE_APIKEY,
    authDomain: import.meta.env.FIREBASE_AUTHDOMAIN,
    projectId: import.meta.env.FIREBASE_PROJECTID,
    storageBucket: import.meta.env.FIREBASE_STORAGEBUCKET,
    messagingSenderId: import.meta.env.FIREBASE_MESSAGINGSENDERID,
    appId: import.meta.env.FIREBASE_APPID
};

const app = initializeApp(firebaseConfig);
const database = getFirestore(app);
const storage = getStorage(app)
export const auth = getAuth(app);
const provider = new GoogleAuthProvider();

export const signInWithGoogle = () => {
    signInWithPopup(auth, provider)
        .then((result) => {
            // This gives you a Google Access Token. You can use it to access the Google API.
            const credential = GoogleAuthProvider.credentialFromResult(result);
        }).catch((error) => {
            const credential = GoogleAuthProvider.credentialFromError(error);
        });
}

export const logOut = () => signOut(auth)

const destinationsRef = collection(database, "destinations");

const usePendingData = (func, mapper) => {
    const [state, setState] = useState({
        loading: true,
        error: null,
        data: null
    });

    const refresh = () => {
        func().then((value) => {
            setState({
                loading: false,
                error: null,
                data: mapper(value)
            });
        }).catch((err) => {
            console.error(err);
            setState({
                loading: false,
                error: err.message,
                data: null
            })
        });
    }

    useEffect(() => {
        refresh();
    }, []);

    return {state, refresh};
}

const useDoc = (doc) => {
    return usePendingData(() => getDoc(doc), (value) => ({ id: value.id, ...value.data() })).state
}

const useDocs = (query) => {
    return usePendingData(() => getDocs(query), (value) => value.docs.map((doc) => ({ id: doc.id, ...doc.data() }))).state
}

export const useDestinations = () => {
    return useDocs(destinationsRef);
}

export const useDestinationById = (id) => {
    return useDoc(doc(database, "destinations", id));
}

export const useMyDestination = () => {
    return useDocs(query(destinationsRef, where("userUid", "==", auth.currentUser.uid)));
}

const useAction = (action) => {
    const [isLoading, setIsLoading] = useState(false);

    const runAction = async (data) => {
        if (isLoading) return { success: false };

        setIsLoading(true);
        try {
            const res = await action(data);
            setIsLoading(false);
            return {
                success: true,
                data: res
            }
        } catch (e) {
            console.error(e);
            setIsLoading(false);
            return {
                success: false,
                error: e
            }
        }
    }

    return {
        isLoading,
        runAction
    }
}

export const useAddDestination = () => {
    const { isLoading, runAction } = useAction(async (data) => {
        const currentUser = auth.currentUser;
        if (!currentUser) throw new Error("Not logged in");

        return await addDoc(destinationsRef, {
            ...data,
            userUid: currentUser.uid
        })
    }
    )
    return {
        isLoading,
        addDestination: runAction
    }
}

export const useEditDestination = () => {
    const { isLoading, runAction } = useAction(async ({ id, data }) => {
        return await setDoc(doc(database, "destinations", id), data, { merge: true });
    })
    return {
        isLoading,
        editDestination: runAction
    }
};

const destinationStorageRef = ref(storage, "destinations");

const getDestinationImageRef = (id) => ref(destinationStorageRef, `${id}/image`);

export const useUploadDestinationImage = (id) => {
    const { isLoading, runAction } = useAction(async (file) => {
        return await uploadBytes(getDestinationImageRef(id), file);
    })
    return {
        isLoading,
        uploadDestinationImage: runAction
    }
}

export const useDestinationImageUrl = (id) => {
    const {state, refresh} = usePendingData(async () => {
        try {
            return await getDownloadURL(getDestinationImageRef(id));
        } catch (error) {
            if (error.code == 'storage/object-not-found') {
                return null;
            }
            throw error;
        }
    }, (doc) => doc)

    return {
        url: state,
        refresh
    }
}