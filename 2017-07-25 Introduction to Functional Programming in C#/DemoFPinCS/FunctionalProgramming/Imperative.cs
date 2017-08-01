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
            Console.WriteLine("Start Imperative style Demo");
            var itemList = new List<BigInteger>();
            for (int i = 0; i < 20; i++)
            {
                itemList.Add(i);
            }
            ((IEnumerable<BigInteger>)itemList).Print("Take 20: ");
            Console.WriteLine();

            Console.WriteLine();

            var itemList1 = new List<BigInteger>();
            for (int i = 0 + 921; i < 20 + 921; i++)
            {
                itemList1.Add(i); 
            }
            ((IEnumerable<BigInteger>)itemList1).Print("Where > 920 && Take 20: ");
            Console.WriteLine();

            Console.WriteLine();
            var take = 0;
            var itemList2 = new List<BigInteger>();
            for (int i = 0; i < to && itemList2.Count < 20; i++)
            {
                if (i % 2 == 0
                    && i % 3 == 0
                    && i % 5 == 0)
                {
                    itemList2.Add(i);
                }
            }
            ((IEnumerable<BigInteger>)itemList2).Print("take first 20 elements of number Divisible by 2, 3, 5");
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
            Console.WriteLine("Zip x and y to (x, y)");
            var toTake = 0;
            var tupleList = new List<(BigInteger, BigInteger)>();
            for (BigInteger i = from, j = to; i <= to; i++, j--)
            {
                if (toTake < 10)
                {
                    tupleList.Add((i, j));
                }

                toTake++;
            }
            Console.WriteLine();
            Console.WriteLine();

        }
    }
}
