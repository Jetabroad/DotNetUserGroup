using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace ParadigmShiftCS.MismatchAbstraction
{
    using static ImageFrame;

    public static class Demo
    {
        public static void Run()
        {
            var eagle = new Eagle();
            var ostrich = new Ostrich();
            var birdWalkingFrame = EmbedBirdWalkImageFrames(eagle);
            var ostrichWalkingFrame = EmbedBirdWalkImageFrames(ostrich);
        }
    }
    public class Image { }
    public interface IBird
    {
        Image[] GetFlyingImageFrames();
        Image[] GetWalkImageFrames();
    }

    public class Eagle : IBird
    {
        public Image[] GetFlyingImageFrames() => new Image[0];
        public Image[] GetWalkImageFrames() => new Image[0];
    }

    public class Ostrich : IBird
    {
        public Image[] GetFlyingImageFrames() => throw new NotSupportedException();
        public Image[] GetWalkImageFrames() => new Image[0];
    }

    public static class ImageFrame
    {
        public static Image[] EmbedBirdFlyingImageFrames(IBird bird)
        {
            var walkingFrames = bird.GetFlyingImageFrames();

            // process something.

            return new Image[0];
        }
        public static Image[] EmbedBirdWalkImageFrames(IBird bird)
        {
            var walkingFrames = bird.GetWalkImageFrames();

            // process something.

            return new Image[0];
        }
    }
}
