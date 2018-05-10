using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace ParadigmShiftCS.HellOfInheritance
{
    public static class Demo
    {
        public static void Run()
        {

        }
    }
    // assembly1.dll
    public interface IQudrilateral
    {
        decimal GetPerimeter();
    }

    public class Rectangle : IQudrilateral
    {
        public Rectangle(decimal width, decimal height)
        {
            Width = width;
            Height = height;
        }
        public decimal Width { get; }
        public decimal Height { get; }
        public decimal GetPerimeter() => (Height + Width) * 2;
    }

    public class Square : IQudrilateral
    {
        public Square(decimal size)
        {
            Size = size;
        }
        public decimal Size { get; }
        public decimal GetPerimeter() => Size * 4;
    }
    ////////////////////////////////////

    // assembly2.dll

    public class Image { }
    public interface ISymetricalShape
    {
        Image DrawHalfImage();
    }

    public class RectangleSymetricalShape : ISymetricalShape
    {
        private readonly Rectangle rectangle;

        public RectangleSymetricalShape(Rectangle rectangle)
        {
            this.rectangle = rectangle;
        }

        public Image DrawHalfImage() => new Image();
    }
    public class SquareSymetricalShape : ISymetricalShape
    {
        private readonly Square square;

        public SquareSymetricalShape(Square square)
        {
            this.square = square;
        }

        public Image DrawHalfImage() => new Image();
    }
    //////////////////////////////////

    // assembly3.dll

    public interface IShape
    {
        Image Draw();
    }

    public class RectangleShape : IShape
    {
        private readonly Rectangle rectangle;

        public RectangleShape(Rectangle rectangle)
        {
            this.rectangle = rectangle;
        }

        public Image Draw() => new Image();
    }
    public class SquareShape : IShape
    {
        private readonly Square square;

        public SquareShape(Square square)
        {
            this.square = square;
        }

        public Image Draw() => new Image();
    }
    //////////////////////////////////

    // assembly4.dll
    public interface ISymetricalFullShape : ISymetricalShape, IShape { }
    public class RectangleSymetricalFullShape : ISymetricalFullShape
    {
        private readonly Rectangle rectangle;

        public RectangleSymetricalFullShape(Rectangle rectangle)
        {
            this.rectangle = rectangle;
        }

        public Image Draw() => new Image();
        public Image DrawHalfImage() => new Image();
    }
    public class SquareSymetricalFullShape : ISymetricalFullShape
    {
        private readonly Square square;

        public SquareSymetricalFullShape(Square square)
        {
            this.square = square;
        }

        public Image Draw() => new Image();
        public Image DrawHalfImage() => new Image();
    }

    public static class Shape
    {
        public static Image DrawHalfAndFullImage(ISymetricalFullShape shape)
        {
            var halfImage = shape.DrawHalfImage();
            var fullImage = shape.Draw();

            return new Image();
        }
    }
    //////////////////////////////////
}
