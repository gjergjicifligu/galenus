"use client";
export default function ErrorPage({ reset }: { reset: () => void }) {
  return (
    <main className="loading-screen">
      <h1>Diçka shkoi keq. / Something went wrong.</h1>
      <button onClick={reset}>Provoni përsëri / Try again</button>
    </main>
  );
}
