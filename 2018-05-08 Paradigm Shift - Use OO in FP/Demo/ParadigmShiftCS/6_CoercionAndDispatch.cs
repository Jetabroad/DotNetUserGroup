using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace ParadigmShiftCS.CoercionAndDispatch
{
    using static DeviceStore;

    public static class Demo
    {
        public static void Run()
        {
            var macBook = new MacBook();
            var kindle = new Kindle();

            var macBookPrice = GetPrice(macBook);
            var kindlePrice = GetPrice(kindle);
        }
    }
    public class MacBook { }
    public class Kindle { }

    public static class DeviceStore
    {
        public static decimal GetBasePrice(MacBook macBook) => 1000;
        public static decimal GetUplift(MacBook macBook) => 50;

        public static decimal GetBasePrice(Kindle macBook) => 50;
        public static decimal GetUplift(Kindle macBook) => 20;

        public static decimal GetPrice(MacBook device) =>
            GetPrice(GetBasePrice(device), GetUplift(device));
        public static decimal GetPrice(Kindle device) =>
            GetPrice(GetBasePrice(device), GetUplift(device));

        static decimal GetPrice(decimal basePrice, decimal uplift) =>
            basePrice + uplift;

        /*
        public static decimal GetPrice<T>(T device)
            //where there exist GetBasePrice(T, decimal) and GetUplift(T, decimal)
            => GetPrice((GetBasePrice(device), GetUplift(device)));
        */

    }
}
