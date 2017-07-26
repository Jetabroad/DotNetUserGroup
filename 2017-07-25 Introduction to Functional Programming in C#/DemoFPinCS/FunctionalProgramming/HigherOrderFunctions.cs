using System;
using System.Collections.Generic;
using System.Linq;
using System.Numerics;
using System.Text;

namespace FunctionalProgramming
{
    public static class HigherOrderFunctions
    {
        private static IEnumerable<BigInteger> someSeq = Utility.SeqFromTo(0, 1000);

        private static IEnumerable<BigInteger> twoToHundred = Utility.SeqFromTo(2, 100);

        public static void DemoHigherOrderFunctions()
        {
            someSeq.Take(20)
                   .Print("Take 20: ");

            someSeq.Where(x => x > 920)
                   .Take(20)
                   .Print("Where > 920 && Take 20: ");

                    //tail.Print("tail");
            someSeq.Where(x => x % 2 == 0)
                   .Where(x => x % 3 == 0)
                   .Where(x => x % 5 == 0)
                   .Take(20)
                   .Print("take first 20 elements of number Divisible by 2, 3, 5");

            someSeq.Aggregate((x, y) => x + y)
                   .Print("Sum of the list from 0 to 1000");

            someSeq.Zip(someSeq.Reverse(), (x, y) => (x, y))
                   .Take(10)
                   .Print("Zip x and y to (x, y)");

            twoToHundred.Join(twoToHundred, x => true, y => true, (x, y) => Power(x, y))
                        .Distinct()
                        .Count()
                        .Print("Project Euler #29");

            twoToHundred.Select(x => twoToHundred.Select(y => Power(x, y)))
                        .Aggregate((x, y) => x.Union(y))
                        .Count()
                        .Print("Project Euler #29 Alternative");

            //BigInteger number = 123456789;

            //number.NumberFactorize()
            //      .Print("Factorizing number");

        }

        public static BigInteger Power(BigInteger n, BigInteger expo)
        {
            if (expo == 1) return n;

            return n * Power(n, expo - 1);
        }

        public static void Print<T>(this IEnumerable<T> list, string description)
        {
            Console.WriteLine($"{description}");
            Console.WriteLine($"[{list.JoinToStringWith(",")}]");
            Console.WriteLine();
        }
        public static void Print<T>(this T number, string description)
        {
            Console.WriteLine($"{description}");
            Console.WriteLine($"{number}");
            Console.WriteLine();
        }

        public static string JoinToStringWith<T>(this IEnumerable<T> list, string separator)
        {
            return list.Select(e => e.ToString()).JoinToStringWith(",");
        }

        public static string JoinToStringWith(this IEnumerable<string> list, string separator)
        {
            return string.Join(separator, list);
        }

        public static IEnumerable<BigInteger> NumberFactorize(this BigInteger number)
        {
            var firstPart = Factorize
            (
                number, 
                Utility.SeqFrom(2).TakeWhile(x => x + x <= number)
            ).ToList();

            return firstPart.Union
            (
                firstPart.Select(x => number / x)
            ).OrderBy(x => x).Prepend(1);
        }
        public static IEnumerable<BigInteger> Factorize
        (
            BigInteger number, 
            IEnumerable<BigInteger> numberList
        )
        {
            return numberList.Where(x => number % x == 0); 
        }
    }
}
