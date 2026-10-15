import { newsletterCopy } from "./newsletter-copy";
export type Lang = "sq" | "en";
export const copy = {
  sq: {
    ...newsletterCopy.sq,
    moduleIncomplete:
      "Për publikim, shtoni titullin dhe përshkrimin në të dyja gjuhët dhe zgjidhni një imazh.",
    fileTooLarge: "Skedari tejkalon kufirin 100 MB.",
    invalidMedia:
      "Skedari është i dëmtuar ose nuk përmban një foto, video ose PDF të vlefshme.",
    unsupportedMedia:
      "Formati nuk mbështetet. Përdorni JPEG, PNG, WebP, MP4, WebM ose PDF.",
    dropFiles: "Tërhiqni skedarët këtu ose zgjidhini më poshtë.",
    enrollmentNote:
      "Të dhënat tuaja përdoren për regjistrimin dhe aksesin në këtë modul.",
    lastName: "Mbiemri",
    firstName: "Emri",
    contacts: "Të dhënat e kontaktit",
    phone: "Telefoni",
    address: "Adresa",
    hours: "Orari",
    lecturerDetails: "Të dhënat e lektorit",
    view: "Shikoni",
    draft: "E papublikuar",
    publish: "Publikoni",
    unpublish: "Çpublikoni",
    viewPublic: "Shikoni në faqe",
    mediaInUse:
      "Kjo media përdoret në përmbajtje. Hiqeni nga të gjitha regjistrimet përpara se ta fshini.",
    medicine: "Mjekësi",
    dentistry: "Stomatologji",
    development: "Zhvillim profesional",
    perspective: "Një perspektivë e re",
    artTitle: "Shkencë. Praktikë. Përparim.",
    illustration: "Ilustrim",
    edit: "Redaktoni",
    heroMedia: "Imazhi i kryefaqes",
    home: "Kryefaqja",
    about: "Rreth nesh",
    gallery: "Galeria",
    modules: "Modulet",
    contact: "Na kontaktoni",
    dashboard: "Menaxhimi",
    tagline: "Ekspertizë. Praktikë. Profesionalizëm.",
    eyebrow: "EDUKIM PROFESIONAL NË MJEKËSI DHE STOMATOLOGJI",
    hero: "Dija që bëhet praktikë.",
    intro:
      "Një hap përpara në zhvillimin tuaj profesional. Bashkojmë njohuritë shkencore me praktikën klinike përmes edukimit në mjekësi dhe stomatologji.",
    explore: "Eksploroni modulet",
    discover: "Njihuni me akademinë",
    approach: "Nga njohuria shkencore te praktika klinike.",
    aboutText:
      "Galenus Med Academy është një akademi e përkushtuar ndaj edukimit profesional në mjekësi dhe stomatologji. Përmes trajnimeve të specializuara, lektorëve me përvojë dhe metodave bashkëkohore të mësimdhënies, synojmë të kontribuojmë në zhvillimin e vazhdueshëm profesional të pjesëmarrësve.",
    mission: "Misioni ynë",
    missionText:
      "Të mbështesim zhvillimin profesional dhe përmirësimin e aftësive klinike duke ndërthurur teorinë me praktikën.",
    theory: "Njohuri shkencore",
    theoryText:
      "Një qasje edukative që vendos njohurinë në themel të zhvillimit profesional.",
    practice: "Praktikë klinike",
    practiceText:
      "Kurse dhe trajnime profesionale që bashkojnë teorinë me praktikën.",
    community: "Të mësuarit së bashku",
    communityText:
      "Seminare dhe aktivitete edukative të udhëhequra nga profesionistë me përvojë.",
    learning: "Hapësira juaj e të mësuarit",
    featured: "Edukimi vazhdon këtu.",
    libraryText:
      "Eksploroni modulet e akademisë dhe regjistrohuni për të zgjeruar njohuritë tuaja.",
    allModules: "Të gjitha modulet",
    team: "NJERËZIT PAS AKADEMISË",
    doctors: "Njihuni me mjekët tanë.",
    doctorIntro:
      "Njihuni me mjekët e Galenus Med Academy dhe profilet e tyre profesionale.",
    profilePending: "Biografia dhe të dhënat profesionale do të shtohen.",
    specialty: "Specialiteti",
    biography: "Biografia",
    qualifications: "Kualifikimet",
    experience: "Përvoja profesionale",
    pending: "Informacioni do të shtohet.",
    photoPending: "Vendmbajtës për fotografinë",
    mediaPending: "Vendmbajtës për median",
    galleryTitle: "Momente të të mësuarit.",
    galleryText:
      "Foto dhe video nga kurset, seminaret dhe aktivitetet edukative të akademisë.",
    viewGallery: "Eksploroni galerinë",
    all: "Të gjitha",
    image: "Foto",
    video: "Video",
    emptyGallery:
      "Galeria është në përgatitje. Aktivitetet do të publikohen këtu.",
    emptyModules:
      "Modulet janë në përgatitje. Programi do të publikohet së shpejti.",
    cta: "Hapi juaj i radhës fillon me dije.",
    ctaText:
      "Zbuloni hapësirën tonë të edukimit profesional në mjekësi dhe stomatologji.",
    contactPending: "Të dhënat e kontaktit do të publikohen së shpejti.",
    footerText: "Edukimi profesional. Njohuri që lidhen me praktikën.",
    preview: "Paraqitja",
    full: "Materialet e modulit",
    email: "Adresa e emailit",
    subscribe: "Regjistrohuni në modul",
    success: "Regjistrimi juaj në këtë modul u krye me sukses.",
    invalid: "Kontrolloni fushat e detyrueshme dhe adresën e emailit.",
    error: "Veprimi nuk u krye. Provoni përsëri.",
    unavailable: "Përmbajtja nuk është publikuar ende.",
    datePending: "Data do të konfirmohet",
    lecturer: "Lektori",
    back: "Kthehu te modulet",
    placeholder: "Përmbajtje ilustruese · për t’u plotësuar",
    login: "Hyrja e stafit",
    password: "Fjalëkalimi",
    signIn: "Hyni",
    signOut: "Dilni",
    save: "Ruani",
    saved: "Ndryshimet u ruajtën.",
    delete: "Fshini",
    confirmDelete: "Dëshironi ta fshini këtë regjistrim?",
    add: "Shtoni regjistrim",
    pages: "Përmbajtja dhe përkthimet",
    users: "Përdoruesit",
    settings: "Cilësimet",
    subscriptions: "Regjistrimet me email",
    media: "Biblioteka e mediave",
    title: "Titulli",
    description: "Përshkrimi",
    date: "Data",
    category: "Kategoria",
    name: "Emri",
    role: "Roli",
    admin: "Administrator",
    user: "Përdorues",
    published: "Publikuar",
    featuredLabel: "I përzgjedhur",
    thumbnail: "Imazhi",
    fullMedia: "Video e plotë (private)",
    upload: "Ngarkoni media",
    publicMedia: "Publike",
    privateMedia: "Private",
    loading: "Duke ngarkuar…",
    noRecords: "Nuk ka regjistrime.",
    chooseMedia: "Zgjidhni median",
    accessDenied: "Nuk keni leje për këtë veprim.",
    loginError: "Emaili ose fjalëkalimi nuk është i saktë.",
    rateLimit: "Shumë përpjekje. Provoni përsëri pas 15 minutash.",
    navigation: "Navigimi",
    contactEmail: "Emaili i kontaktit",
    siteName: "Emri i akademisë",
    manageIntro: "Menaxhoni përmbajtjen e akademisë në të dyja gjuhët.",
    skip: "Kaloni te përmbajtja",
    menu: "Hapni menynë",
    close: "Mbyllni",
    requiredPassword: "Fjalëkalim i ri (të paktën 12 karaktere)",
    placeholderLabel: "Shëno si vendmbajtës",
    galleryLinkText: "Një vështrim në aktivitetet tona edukative.",
    language: "Gjuha",
    notFound: "Faqja nuk u gjet.",
    returnHome: "Kthehu në kryefaqe",
    noAccess: "Ju lutemi hyni me llogarinë tuaj të stafit.",
    uploadHelp: "JPEG, PNG, WebP, MP4, WebM ose PDF. Maksimumi 100 MB.",
    privateHelp: "Materialet e moduleve duhet të ngarkohen si private.",
    blankPassword: "Lëreni bosh për të ruajtur fjalëkalimin aktual.",
    retention:
      "Fshini regjistrimet kur nuk nevojiten më, sipas politikës së akademisë.",
  },
  en: {
    ...newsletterCopy.en,
    moduleIncomplete:
      "To publish, add a title and description in both languages and select a preview image.",
    fileTooLarge: "The file exceeds the 100 MB limit.",
    invalidMedia:
      "The file is damaged or does not contain a valid image, video or PDF.",
    unsupportedMedia:
      "Unsupported format. Use JPEG, PNG, WebP, MP4, WebM or PDF.",
    dropFiles: "Drag files here or choose files below.",
    enrollmentNote:
      "Your details are used for enrollment and access to this module.",
    lastName: "Last name",
    firstName: "First name",
    contacts: "Contact details",
    phone: "Phone",
    address: "Address",
    hours: "Opening hours",
    lecturerDetails: "Lecturer details",
    view: "View",
    draft: "Unpublished",
    publish: "Publish",
    unpublish: "Unpublish",
    viewPublic: "View on website",
    mediaInUse:
      "This media is in use. Remove it from all content records before deleting it.",
    medicine: "Medicine",
    dentistry: "Dentistry",
    development: "Professional development",
    perspective: "A new perspective",
    artTitle: "Science. Practice. Progress.",
    illustration: "Illustration",
    edit: "Edit",
    heroMedia: "Homepage image",
    home: "Home",
    about: "About us",
    gallery: "Gallery",
    modules: "Modules",
    contact: "Get in touch",
    dashboard: "Management",
    tagline: "Expertise. Practice. Professionalism.",
    eyebrow: "PROFESSIONAL EDUCATION IN MEDICINE & DENTISTRY",
    hero: "Knowledge, put into practice.",
    intro:
      "Take the next step in your professional development. We bring scientific knowledge and clinical practice together through education in medicine and dentistry.",
    explore: "Explore modules",
    discover: "Discover the academy",
    approach: "From scientific knowledge to clinical practice.",
    aboutText:
      "Galenus Med Academy is dedicated to professional education in medicine and dentistry. Through specialized training, experienced lecturers, and contemporary teaching methods, we aim to contribute to participants’ ongoing professional development.",
    mission: "Our mission",
    missionText:
      "To support professional development and improve clinical skills by bringing theory and hands-on practice together.",
    theory: "Scientific knowledge",
    theoryText:
      "An educational approach that places knowledge at the heart of professional development.",
    practice: "Clinical practice",
    practiceText:
      "Professional courses and training that combine theory with hands-on practice.",
    community: "Learning together",
    communityText:
      "Seminars and educational activities led by experienced professionals.",
    learning: "Your space to learn",
    featured: "Your education continues here.",
    libraryText:
      "Explore the academy’s modules and enroll to build your knowledge.",
    allModules: "All modules",
    team: "THE PEOPLE BEHIND THE ACADEMY",
    doctors: "Meet our doctors.",
    doctorIntro:
      "Explore the doctors of Galenus Med Academy and their professional profiles.",
    profilePending: "Biography and professional details will be added.",
    specialty: "Specialty",
    biography: "Biography",
    qualifications: "Qualifications",
    experience: "Professional experience",
    pending: "Information to be added.",
    photoPending: "Photo placeholder",
    mediaPending: "Media placeholder",
    galleryTitle: "Moments of learning.",
    galleryText:
      "Photos and videos from the academy’s courses, seminars, and educational activities.",
    viewGallery: "Explore the gallery",
    all: "All",
    image: "Photo",
    video: "Video",
    emptyGallery:
      "Our gallery is being prepared. Educational activities will be shared here.",
    emptyModules:
      "Our modules are being prepared. The program will be announced soon.",
    cta: "Your next step begins with knowledge.",
    ctaText:
      "Discover our space for professional education in medicine and dentistry.",
    contactPending: "Contact details will be published soon.",
    footerText: "Professional education. Knowledge connected to practice.",
    preview: "Preview",
    full: "Module materials",
    email: "Email address",
    subscribe: "Enroll in this module",
    success: "You have successfully enrolled in this module.",
    invalid: "Please check the required fields and email address.",
    error: "We couldn’t complete this action. Please try again.",
    unavailable: "This content is not available yet.",
    datePending: "Date to be confirmed",
    lecturer: "Lecturer",
    back: "Back to modules",
    placeholder: "Illustrative content · to be completed",
    login: "Staff sign in",
    password: "Password",
    signIn: "Sign in",
    signOut: "Sign out",
    save: "Save changes",
    saved: "Changes saved.",
    delete: "Delete",
    confirmDelete: "Delete this record?",
    add: "Add record",
    pages: "Content & translations",
    users: "Users",
    settings: "Settings",
    subscriptions: "Email subscriptions",
    media: "Media library",
    title: "Title",
    description: "Description",
    date: "Date",
    category: "Category",
    name: "Name",
    role: "Role",
    admin: "Admin",
    user: "User",
    published: "Published",
    featuredLabel: "Featured",
    thumbnail: "Image",
    fullMedia: "Full video (private)",
    upload: "Upload media",
    publicMedia: "Public",
    privateMedia: "Private",
    loading: "Loading…",
    noRecords: "No records yet.",
    chooseMedia: "Select media",
    accessDenied: "You don’t have permission to perform this action.",
    loginError: "The email or password is incorrect.",
    rateLimit: "Too many attempts. Please try again in 15 minutes.",
    navigation: "Navigation",
    contactEmail: "Contact email",
    siteName: "Academy name",
    manageIntro: "Manage the academy’s content in both languages.",
    skip: "Skip to content",
    menu: "Open menu",
    close: "Close",
    requiredPassword: "New password (at least 12 characters)",
    placeholderLabel: "Mark as placeholder",
    galleryLinkText: "A look inside our educational activities.",
    language: "Language",
    notFound: "Page not found.",
    returnHome: "Return home",
    noAccess: "Please sign in with your staff account.",
    uploadHelp: "JPEG, PNG, WebP, MP4, WebM or PDF. Maximum 100 MB.",
    privateHelp: "Module materials must be uploaded as private.",
    blankPassword: "Leave blank to keep the current password.",
    retention:
      "Delete records when no longer needed, in accordance with academy policy.",
  },
};
export type Copy = typeof copy.en;
export type RecordData = {
  id: string;
  kind: string;
  name?: string;
  title_sq?: string;
  title_en?: string;
  description_sq?: string;
  description_en?: string;
  biography_sq?: string;
  biography_en?: string;
  specialty_sq?: string;
  specialty_en?: string;
  qualifications_sq?: string;
  qualifications_en?: string;
  experience_sq?: string;
  experience_en?: string;
  category_sq?: string;
  category_en?: string;
  lecturer?: string;
  date?: string;
  thumbnail?: string;
  fullMedia?: string;
  resources?: ModuleResource[];
  media?: string;
  published?: boolean;
  featured?: boolean;
  placeholder?: boolean;
  [key: string]: unknown;
};
export type ModuleResource = {
  id: string;
  media: string;
  title_sq: string;
  title_en: string;
  description_sq: string;
  description_en: string;
  language: "sq" | "en" | "both";
  order: number;
  published: boolean;
  mime?: string;
};
export function localized(r: RecordData, field: string, lang: Lang) {
  return String(r[`${field}_${lang}`] || "");
}
