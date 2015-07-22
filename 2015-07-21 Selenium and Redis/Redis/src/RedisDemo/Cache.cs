using Newtonsoft.Json;
using StackExchange.Redis;
using System;

namespace RedisDemo
{
    public static class Cache
    {
        public static readonly IConnectionMultiplexer multiplexer = ConnectionMultiplexer.Connect("localhost:6379,syncTimeout=30000");
        public static Func<T, TResult> Map<T, TResult>(Func<T, TResult> f)
        {
            return t =>
            {
                IDatabase db = null;
                string key = null;

                try
                {
                    key = typeof(TResult).Name + ":" + t.ToString();
                    db = multiplexer.GetDatabase();

                    var value = db.StringGet(key);

                    if (value.HasValue)
                    {
                        Console.WriteLine("Getting {0} from cache.", key);

                        return JsonConvert.DeserializeObject<TResult>(value.ToString());
                    }
                }
                catch
                {
                    //cache error.
                }

                var result = f(t);

                try
                {
                    if (key != null)
                    {

                        Console.WriteLine("Saving {0} to cache...", key);

                        db.StringSet(key, JsonConvert.SerializeObject(result), TimeSpan.FromMinutes(30));
                    }
                }
                catch
                {
                    //cache error.
                }

                return result;
            };
        }
    }
}
