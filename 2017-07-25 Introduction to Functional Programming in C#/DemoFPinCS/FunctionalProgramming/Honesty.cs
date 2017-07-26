using System;
using System.Collections.Generic;
using System.Linq;
using System.Numerics;
using System.Text;

namespace FunctionalProgramming
{
    public static class Honesty
    {
        public static TimeSpan Aging1(DateTime fromDate)
        {
            return DateTime.Now - fromDate;
        }

        public static TimeSpan Aging(DateTime fromDate, DateTime toDate)
        {
            return toDate - fromDate;
        }

        public static double Reciprocal(this BigInteger number)
        {
            return 1.0 / (double)number;
        }

        public static Nullable<double> Reciprocal2(this BigInteger number)
        {
            if (number == 0) return null;
            return 1.0 / (double)number;
        }

        public static double Reciprocal3(this BigInteger number)
        {
            if (number == 0) throw new ArgumentException("Number must not be 0");
            return 1.0 / (double)number;
        }
        public static void HonestyDemo()
        {
            Console.WriteLine("Age {0}", Honesty.Aging1(new DateTime(2017, 1, 1)));
            System.Threading.Thread.Sleep(100);
            Console.WriteLine("Age {0}", Honesty.Aging1(new DateTime(2017, 1, 1)));
            System.Threading.Thread.Sleep(100);
            Console.WriteLine("Age {0}", Honesty.Aging1(new DateTime(2017, 1, 1)));
            System.Threading.Thread.Sleep(100);
            Console.WriteLine("Age {0}", Honesty.Aging1(new DateTime(2017, 1, 1)));
            System.Threading.Thread.Sleep(100);
            Console.WriteLine("Age {0}", Honesty.Aging1(new DateTime(2017, 1, 1)));
            System.Threading.Thread.Sleep(100);
            Console.WriteLine("Age {0}", Honesty.Aging1(new DateTime(2017, 1, 1)));
            System.Threading.Thread.Sleep(100);

            Console.WriteLine("Age {0}", Honesty.Aging(new DateTime(2017, 1, 1), DateTime.Now));
            System.Threading.Thread.Sleep(100);
            Console.WriteLine("Age {0}", Honesty.Aging(new DateTime(2017, 1, 1), DateTime.Now));
            System.Threading.Thread.Sleep(100);
            Console.WriteLine("Age {0}", Honesty.Aging(new DateTime(2017, 1, 1), DateTime.Now));
            System.Threading.Thread.Sleep(100);
            Console.WriteLine("Age {0}", Honesty.Aging(new DateTime(2017, 1, 1), DateTime.Now));
            System.Threading.Thread.Sleep(100);
            Console.WriteLine("Age {0}", Honesty.Aging(new DateTime(2017, 1, 1), DateTime.Now));
            System.Threading.Thread.Sleep(100);

            Utility.SeqFromTo(10, 0, -1).Select(elem => elem.Reciprocal()).Print("The Reciprocal: ");
            Utility.SeqFromTo(10, 0, -1).Select(elem => elem.Reciprocal2()).Print("The Reciprocal: ");
            Utility.SeqFromTo(10, 0, -1).Select(elem =>
            { try { return elem.Reciprocal3(); } catch { return default(double); } }).Print("The Reciprocal: ");
            Utility.SeqFromTo(10, 0, -1).Print("Teest");
            BigInteger x = 100;
            Console.WriteLine(x.Reciprocal());

            /*
            for (BigInteger i = 10; i >= 0; i--)
            {

                var result = i.Reciprocal();
                var str = string.Format($"{result:0.000000}");
                Console.WriteLine($"1/{i} = {result:0.000000}");
            }

            for (BigInteger i = 10; i >= 0; i--)
            {
                var result = i.Reciprocal2();
                if (result != null)
                {
                    Console.WriteLine($"1/{i} = {result:0.000000}");
                }
            }


            for (BigInteger i = 10; i >= 0; i--)
            {
                try
                {
                    var result = i.Reciprocal3();
                    Console.WriteLine($"1/{i} = {result:0.000000}");
                }
                catch (ArgumentException ex)
                {
                    Console.WriteLine("{0}", ex.Message);
                }
            }
            */
        }
    }
}
