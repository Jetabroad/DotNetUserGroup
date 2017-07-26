using System;
using System.Collections.Generic;
using System.Numerics;
using System.Text;

namespace FunctionalProgramming
{
    public class Imperative
    {

        private static BigInteger from = 0;
        private static BigInteger to = 1000;

        private static BigInteger two = 2;
        private static BigInteger hundred = 100;

        public static void DemoImperative()
        {

            Console.WriteLine();
            Console.WriteLine("Take 20: ");
            for(int i = 0; i < 20; i++)
            {
                if (i == 20 - 1)
                {
                    Console.Write("{0}]", i);
                }
                else if (i == 0)
                {
                    Console.Write("[{0},");
                }
                else
                {
                    Console.Write("{0},", i);
                }
            }
            Console.WriteLine();

            Console.WriteLine();
            Console.WriteLine("Where > 920 && Take 20: ");
            for (int i = 0 + 920; i <= 20 + 920; i++)
            {
                if (i == 20 + 920)
                {
                    Console.Write("{0}]", i);
                }
                else if (i == 920)
                {
                    Console.Write("[{0},", i);
                }
                else
                {
                    Console.Write("{0},", i);
                }
            }
            Console.WriteLine();

            Console.WriteLine();
            Console.WriteLine("take first 20 elements of number Divisible by 2, 3, 5");
            var take = 0;
            for (int i = 0; i < to && take < 20; i++)
            {
                if (i % 2 == 0 && i % 3 == 0 && i % 5 == 0)
                {
                    if (take == 20 - 1)
                    {
                        Console.Write("{0}]", i);
                    }
                    else if (take == 0)
                    {
                        Console.Write("[{0},", i);
                    }
                    else
                    {
                        Console.Write("{0},", i);
                    }

                    take++;
                }
            }
            Console.WriteLine();

            Console.WriteLine();
            Console.WriteLine("Sum of the list from 0 to 1000");
            BigInteger sum = 0;
            for (var i = from; i <= to; i++)
            {
                sum += i;
            }
            Console.WriteLine("{0}", sum);
            Console.WriteLine();

            Console.WriteLine();
            var toTake = 0;
            Console.WriteLine("Zip x and y to (x, y)");
            for(BigInteger i = from, j = to; i <= to; i++, j--)
            {
                if (toTake < 10)
                {
                    var temp = (i, j);
                    if (toTake == 10 - 1)
                    {
                        Console.Write("{0}]", temp);
                    }
                    else if (i == from)
                    {
                        Console.Write("[{0},", temp);
                    }
                    else
                    {
                        Console.Write("{0},", temp);
                    }
                }

                toTake++;
            }
            Console.WriteLine();
            Console.WriteLine();

        }
    }
}
