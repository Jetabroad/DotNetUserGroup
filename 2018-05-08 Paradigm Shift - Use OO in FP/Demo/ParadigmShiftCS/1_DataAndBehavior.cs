using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace ParadigmShiftCS.DataAndBehavior
{
    public static class Demo
    {
        public static void Run()
        {
            var rectangle = new Rectangle(width: 3, height: 5);
            var (width, height) = rectangle;
        }
    }
    public class Rectangle
    {
        public Rectangle(decimal width, decimal height)
        {
            Width = width;
            Height = height;
        }
        public void Deconstruct(out decimal width, out decimal height)
        {
            width = Width;
            height = Height;
        }
        public decimal Width { get; }
        public decimal Height { get; }
    }

    public static class RectangleUtils
    {
        public static decimal GetRectanglePerimeter(Rectangle rectangle) => (rectangle.Height + rectangle.Width) * 2;
    }
}
