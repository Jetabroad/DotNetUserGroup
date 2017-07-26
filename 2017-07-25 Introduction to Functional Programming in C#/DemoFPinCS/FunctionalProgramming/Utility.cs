using System;
using System.Collections.Generic;
using System.Linq;
using System.Numerics;
using System.Text;

namespace FunctionalProgramming
{
    public static class Utility
    {
        public static (Func<IEnumerable<BigInteger>>, Func<IEnumerable<BigInteger>>) Span(Func<BigInteger, bool> pred, IEnumerable<BigInteger> aList)
        {
            return (() => aList.TakeWhile(pred), () => aList.SkipWhile(pred));
        }
        public static IEnumerable<BigInteger> SeqFromTo(BigInteger from, BigInteger to, BigInteger step)
        {
            return SeqFrom(from, step).TakeWhile(x =>
            {
                return step > 0 ? x <= to : x >= to;
            });
        }
        public static IEnumerable<BigInteger> SeqFromTo(BigInteger from, BigInteger to)
        {
            return SeqFromTo(from, to, 1);
        }

        public static IEnumerable<BigInteger> SeqFrom(BigInteger v)
        {
            return SeqFrom(v, 1);
        }

        public static IEnumerable<BigInteger> SeqFrom(BigInteger v, BigInteger step)
        {
            for (BigInteger i = v; ; i += step)
            {
                yield return i;
            }
        }

        public static IEnumerable<BigInteger> OddFrom(BigInteger v)
        {
            return SeqFrom(v % 2 != BigInteger.Zero ? v : v + 1, 2);
        }
        public static IEnumerable<BigInteger> EvenFrom(BigInteger v)
        {
            return SeqFrom(v % 2 == BigInteger.Zero ? v : v + 1, 2);
        }


        /// <summary>
        /// This is from 
        /// https://fuqua.io/blog/2014/03/haskells-elegant-fibonacci-in-csharp/
        /// </summary>
        /// <typeparam name="T"></typeparam>
        /// <param name="first"></param>
        /// <param name="second"></param>
        /// <returns></returns>
        public static IEnumerable<T> LazyConcat<T>(
            this Func<IEnumerable<T>> first,
            Func<IEnumerable<T>> second)
        {
            foreach (var item in first())
                yield return item;
            foreach (var item in second())
                yield return item;
        }
    }
}
