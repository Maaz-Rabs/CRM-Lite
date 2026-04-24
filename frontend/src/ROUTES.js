// App.jsx mein yeh routes add karo:
//
// import AllProjects  from './pages/Projects/AllProjects';
// import Properties   from './pages/Properties/Properties';
// import AddProperty  from './pages/Properties/AddProperty';
// import ViewProperty from './pages/Properties/ViewProperty';
//
// <Route path="/projects"              element={<AllProjects />} />
// <Route path="/properties/all"        element={<Properties />} />
// <Route path="/properties/add"        element={<AddProperty />} />
// <Route path="/properties/edit/:id"   element={<AddProperty />} />
// <Route path="/properties/view/:id"   element={<ViewProperty />} />
//
// ─── IMPORTANT FIX ───────────────────────────────────────────────────────────
// ViewProperty ab Properties.jsx se import nahi karta.
// Dono Properties.jsx aur ViewProperty.jsx → propertiesData.js se import karte hain.
// Isliye View Details button properly kaam karega.
