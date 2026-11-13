import { Chip } from "../components/Chip";
import { Section } from "../components/Section";
import { experience, focus, profile, toolbox } from "../content/profile";
import { minorProjects, projects } from "../content/projects";
import { HnswSearch } from "./home/HnswSearch";
import { MinorCard, ProjectCard } from "./home/ProjectCard";
import "./Home.css";

export default function Home() {
  const current = experience[0];
  return (
    <>
      <Hero />
      <div className="container">
        <Section id="work" title="Selected work">
          <div className="work-grid">
            {projects.map((p) => (
              <ProjectCard key={p.slug} project={p} />
            ))}
          </div>
          <h3 className="home-subhead">Also</h3>
          <div className="minor-grid">
            {minorProjects.map((p) => (
              <MinorCard key={p.name} project={p} />
            ))}
          </div>
        </Section>

        <Section id="experience" title="Experience">
          <ol className="timeline">
            {experience.map((job) => (
              <li key={`${job.org}-${job.period}`} className="timeline-item">
                <p className="timeline-period">{job.period}</p>
                <div>
                  <h3 className="timeline-role">
                    {job.role} · <span className="timeline-org">{job.org}</span>
                  </h3>
                  <p className="timeline-place">{job.place}</p>
                  <p className="timeline-summary">{job.summary}</p>
                </div>
              </li>
            ))}
          </ol>
        </Section>

        <Section id="toolbox" title="Toolbox">
          <dl className="toolbox">
            {toolbox.map((row) => (
              <div key={row.area} className="toolbox-row">
                <dt>{row.area}</dt>
                <dd>
                  <ul>
                    {row.items.map((item) => (
                      <li key={item}>
                        <Chip>{item}</Chip>
                      </li>
                    ))}
                  </ul>
                </dd>
              </div>
            ))}
          </dl>
        </Section>

        <Section id="about" title="About">
          <div className="about">
            <div className="about-text">
              <p>{profile.intro}</p>
              {profile.about.map((paragraph) => (
                <p key={paragraph}>{paragraph}</p>
              ))}
            </div>
            <dl className="about-facts">
              <div>
                <dt>Education</dt>
                <dd>
                  {profile.education.degree}, {profile.education.minor.toLowerCase()}
                  <br />
                  {profile.education.school}
                  <br />
                  Graduating {profile.education.graduation}
                </dd>
              </div>
              {current && (
                <div>
                  <dt>Now</dt>
                  <dd>
                    {current.role}, {current.org}
                    <br />
                    {profile.activities.join(", ")}
                  </dd>
                </div>
              )}
              <div>
                <dt>Languages</dt>
                <dd>
                  <ul className="about-languages">
                    {profile.languages.map((l) => (
                      <li key={l.name}>
                        {l.name} <span>({l.level})</span>
                      </li>
                    ))}
                  </ul>
                </dd>
              </div>
              <div>
                <dt>Based in</dt>
                <dd>{profile.location}</dd>
              </div>
            </dl>
          </div>
        </Section>

        <Section id="contact" title="Contact">
          <div className="contact">
            <a className="contact-email" href={`mailto:${profile.email}`}>
              {profile.email}
            </a>
            <ul className="contact-links">
              <li>
                <a href={profile.links.github}>GitHub ↗</a>
              </li>
              <li>
                <a href={profile.links.linkedin}>LinkedIn ↗</a>
              </li>
            </ul>
          </div>
        </Section>
      </div>
    </>
  );
}

function Hero() {
  const current = experience[0];
  return (
    <section className="hero" aria-labelledby="hero-name">
      <div className="container hero-inner">
        <div className="hero-text">
          <p className="hero-kicker">{profile.headline}</p>
          <h1 id="hero-name" className="hero-name">
            {profile.name}
          </h1>
          <p className="hero-pitch">{profile.pitch}</p>
          <p className="hero-focus">{focus}</p>
          {current && (
            <p className="hero-meta">
              {current.role} at {current.org} · {profile.location}
            </p>
          )}
          <ul className="hero-links">
            <li>
              <a href={profile.links.github}>GitHub ↗</a>
            </li>
            <li>
              <a href={profile.links.linkedin}>LinkedIn ↗</a>
            </li>
            <li>
              <a href={`mailto:${profile.email}`}>Email</a>
            </li>
          </ul>
        </div>
        <div className="hero-figure">
          <HnswSearch />
        </div>
      </div>
    </section>
  );
}
