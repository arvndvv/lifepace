import bgImage from '../../assets/bg/bg.png';

export const DriftCover = ({LoaderText="Loading your data…"}:{LoaderText?:string}) => {
    return (
      <div style={{
        backgroundImage: `url(${bgImage})`,
        backgroundSize: 'contain',
        backgroundPosition: 'top',
        backgroundRepeat: 'no-repeat',
        width: '100vw',
        backgroundColor: '#eeeae7'
      }}className="flex  h-screen items-end justify-center  text-slate-500 relative">
        <span className='absolute bottom-[10%]'>{LoaderText}</span>
      </div>
    )
}