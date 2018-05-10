using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace ParadigmShiftCS.Coercion
{
    public static class Demo
    {
        public static void Run()
        {

        }
    }
    public class Rectangle
    {
        public Rectangle(decimal width, decimal height)
        {
            Width = width;
            Height = height;
        }
        public decimal Width { get; }
        public decimal Height { get; }
    }

    public class Square
    {
        public Square(decimal size)
        {
            Size = size;
        }
        public decimal Size { get; }
    }

    public class Quadrilateral
    {
        public Quadrilateral(decimal edge1, decimal edge2, decimal edge3, decimal edge4)
        {
            Edge1 = edge1;
            Edge2 = edge2;
            Edge3 = edge3;
            Edge4 = edge4;
        }

        public decimal Edge1 { get; }
        public decimal Edge2 { get; }
        public decimal Edge3 { get; }
        public decimal Edge4 { get; }
    }
    public static class QuadrilateralUtils
    {
        //public static Quadrilateral ToQuadrilateral(Rectangle rectangle) =>
        //    new Quadrilateral(rectangle.Height, rectangle.Width, rectangle.Height, rectangle.Width);

        //public static Quadrilateral ToQuadrilateral(Square square) =>
        //    new Quadrilateral(square.Size, square.Size, square.Size, square.Size);

        //public static decimal GetPerimeter(Quadrilateral quadrilateral) =>
        //    quadrilateral.Edge1 + quadrilateral.Edge2 + quadrilateral.Edge3 + quadrilateral.Edge4;

        public static (decimal, decimal, decimal, decimal) ToQuadrilateral(Rectangle rectangle) =>
            (rectangle.Height, rectangle.Width, rectangle.Height, rectangle.Width);

        public static (decimal, decimal, decimal, decimal) ToQuadrilateral(Square square) =>
            (square.Size, square.Size, square.Size, square.Size);

        public static decimal GetPerimeter((decimal, decimal, decimal, decimal) quadrilateral) =>
            quadrilateral.Item1 + quadrilateral.Item2 + quadrilateral.Item3 + quadrilateral.Item4;
    }

    //public class Image { }
    //public class SymetricalShape
    //{
    //    public SymetricalShape(Image halfImage)
    //    {
    //        HalfImage = halfImage;
    //    }

    //    public Image HalfImage { get; }
    //}

    //public static class SymetricalShapeUtils
    //{
    //    public static SymetricalShape ToSymetricalShape(Rectangle rectangle) => new SymetricalShape(new Image());
    //    public static SymetricalShape ToSymetricalShape(Square rectangle) => new SymetricalShape(new Image());
    //    public static Image DrawHalfImage(SymetricalShape symetricalShape) => new Image();
    //}

    //public class Shape
    //{
    //    public Shape(Image fullImage)
    //    {
    //        FullImage = fullImage;
    //    }

    //    public Image FullImage { get; }
    //}

    //public static class ShapeUtils
    //{
    //    public static Shape ToShape(Rectangle rectangle) => new Shape(new Image());
    //    public static Shape ToShape(Square rectangle) => new Shape(new Image());
    //    public static Image DrawImage(Shape symetricalShape) => new Image();


    //    static (SymetricalShape, Shape) ToSymetricalFullShape(Rectangle rectangle) =>
    //        (SymetricalShapeUtils.ToSymetricalShape(rectangle), ToShape(rectangle));
    //    static (SymetricalShape, Shape) ToSymetricalFullShape(Square rectangle) =>
    //        (SymetricalShapeUtils.ToSymetricalShape(rectangle), ToShape(rectangle));

    //    public static Image DrawSymetricalFullShapeImage(Rectangle rectangle) =>
    //        DrawSymetricalFullShapeImage(ToSymetricalFullShape(rectangle));
    //    public static Image DrawSymetricalFullShapeImage(Square rectangle) =>
    //        DrawSymetricalFullShapeImage(ToSymetricalFullShape(rectangle));
    //    public static Image DrawSymetricalFullShapeImage((SymetricalShape, Shape) shape) =>
    //        new Image();
    //}
}
