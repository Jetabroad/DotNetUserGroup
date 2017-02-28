using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Http;

namespace AspNetCorePush.Helpers.Push
{
    /// <summary>
    /// This class works with <seealso cref="HttpPushTagHelper" /> to add Link http headers to HTTP responses.
    /// CloudFlare, our CDN, will convert these Link headers to HTTP2 Server Push commands.
    /// </summary>
    public class HttpPushMiddleware
    {
        readonly RequestDelegate next;

        public HttpPushMiddleware(RequestDelegate next)
        {
            this.next = next;
        }

        public Task Invoke(HttpContext context)
        {
            context.Response.OnStarting(() => {
                // read PushPromises from the HttpContext and convert them to Link headers.
                var promises = context.Items[HttpPushTagHelper.HttpPushAttributeName] as IList<PushPromise>;
                if (promises != null)
                {
                    var header = string.Join(", ", promises.Select(promise => promise.ToString()));
                    context.Response.Headers.Add("Link", header);
                }
                return Task.FromResult(0);
            });

            return next.Invoke(context);
        }
    }
}
