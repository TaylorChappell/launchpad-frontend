export function HolderRewardFlow() {
  return <div className="hero-current" role="img" aria-label="The AQUA mark suspended in an animated water current">
    <div className="current-haze" aria-hidden="true"/>
    <div className="current-caustics" aria-hidden="true"/>
    <div className="current-stream stream-one" aria-hidden="true"/>
    <div className="current-stream stream-two" aria-hidden="true"/>
    <div className="current-ring ring-one" aria-hidden="true"/>
    <div className="current-ring ring-two" aria-hidden="true"/>
    <div className="current-ring ring-three" aria-hidden="true"/>
    <div className="current-core" aria-hidden="true"><span/><img src={`${import.meta.env.BASE_URL}aqua-logo.png`} alt=""/></div>
    <div className="current-bubbles" aria-hidden="true"><i/><i/><i/><i/><i/><i/><i/><i/><i/><i/><i/><i/></div>
    <div className="current-water" aria-hidden="true"><i/><i/><i/><i/></div>
  </div>;
}
