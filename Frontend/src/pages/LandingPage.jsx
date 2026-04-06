import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import PublicFooter from "../components/layout/PublicFooter";

export default function LandingPage({ user }) {
  const CROSSFADE_MS = 520;
  const slides = [
    {
      id: "transforming-health",
      eyebrow: "Transforming Health",
      title: "Transform hospital operations with secure digital workflows",
      description:
        "Bring appointments, records, and role-based actions into one reliable platform for faster and safer care delivery.",
      image:
        "https://images.pexels.com/photos/7580254/pexels-photo-7580254.jpeg?auto=compress&cs=tinysrgb&w=1400"
    },
    {
      id: "decision-insights",
      eyebrow: "Decision Support",
      title: "Meaningful insights for clinical and administrative decisions",
      description:
        "Use real-time visibility on patient flow and status updates to improve response times across departments.",
      image:
        "https://images.pexels.com/photos/7088530/pexels-photo-7088530.jpeg?auto=compress&cs=tinysrgb&w=1400"
    },
    {
      id: "enterprise-scale",
      eyebrow: "Enterprise Scale",
      title: "Built for multi-site hospitals and high daily patient volume",
      description:
        "Standardize workflows across locations while keeping teams aligned on a single, secure source of truth.",
      image:
        "https://images.pexels.com/photos/4173239/pexels-photo-4173239.jpeg?auto=compress&cs=tinysrgb&w=1400"
    }
  ];

  const [activeSlide, setActiveSlide] = useState(0);
  const [previousSlide, setPreviousSlide] = useState(null);

  function changeSlide(nextIndex) {
    if (nextIndex === activeSlide) {
      return;
    }
    setPreviousSlide(activeSlide);
    setActiveSlide(nextIndex);
  }

  useEffect(() => {
    const timerId = setInterval(() => {
      changeSlide((activeSlide + 1) % slides.length);
    }, 6000);

    return () => clearInterval(timerId);
  }, [activeSlide, slides.length]);

  useEffect(() => {
    if (previousSlide === null) {
      return;
    }

    const timeoutId = setTimeout(() => {
      setPreviousSlide(null);
    }, CROSSFADE_MS);

    return () => clearTimeout(timeoutId);
  }, [previousSlide]);

  const current = slides[activeSlide];

  function goPrevious() {
    changeSlide((activeSlide - 1 + slides.length) % slides.length);
  }

  function goNext() {
    changeSlide((activeSlide + 1) % slides.length);
  }

  return (
    <main className="page-shell">
      <section className="home-slider" aria-label="Homepage highlights">
        <div className="slider-top-row">
          <p className="eyebrow">Electronic Health Records Platform</p>
          <p className="slider-counter">
            {activeSlide + 1} / {slides.length}
          </p>
        </div>

        <div className="slide-stage" key={current.id}>
          <div className={`slide-copy ${previousSlide !== null ? "entering" : ""}`}>
            <p className="slide-kicker">{current.eyebrow}</p>
            <h1>{current.title}</h1>
            <p>{current.description}</p>

            <div className="actions">
              {!user && (
                <>
                  <Link className="btn primary" to="/signup">
                    Create Staff Account
                  </Link>
                  <Link className="btn subtle" to="/signin">
                    Sign In
                  </Link>
                </>
              )}
              {user && (
                <Link className="btn primary" to="/portal">
                  Open Clinical Portal
                </Link>
              )}
            </div>
          </div>

          <div className="slide-media">
            {previousSlide !== null && (
              <img
                alt={slides[previousSlide].title}
                className="slide-image previous"
                src={slides[previousSlide].image}
              />
            )}
            <img
              alt={current.title}
              className={`slide-image current ${previousSlide !== null ? "entering" : ""}`}
              src={current.image}
            />
          </div>
        </div>

        <div className="slide-controls" aria-label="Slide controls">
          <button className="slide-nav" onClick={goPrevious} type="button">
            Previous
          </button>

          <div className="slide-dots" role="tablist" aria-label="Homepage slides">
            {slides.map((slide, index) => (
              <button
                aria-label={`Go to slide ${index + 1}`}
                aria-selected={index === activeSlide}
                className={`slide-dot ${index === activeSlide ? "active" : ""}`}
                key={slide.id}
                onClick={() => changeSlide(index)}
                role="tab"
                type="button"
              />
            ))}
          </div>

          <button className="slide-nav" onClick={goNext} type="button">
            Next
          </button>
        </div>
      </section>

      <PublicFooter />
    </main>
  );
}
