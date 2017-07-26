using System;
using System.Collections.Generic;
using System.Numerics;
using System.Text;

namespace FunctionalProgramming
{
    public static class Immutability
    {
        public static BigInteger accumulated = 0;
        public static BigInteger AddAndStore(BigInteger number)
        {
            accumulated += number;
            return accumulated;
        }
    }
}
