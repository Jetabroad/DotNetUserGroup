using System;
using System.Linq;
using System.Threading.Tasks;
using GitHub;
using InfluxData.Net.InfluxDb;
using InfluxData.Net.Common.Enums;
using InfluxData.Net.InfluxDb.Models;
using System.Configuration;
using System.Collections.Generic;
using Newtonsoft.Json;

namespace MyTestWebApp
{
    /// <summary>
    /// Writes the result of an experiment to InfluxDB
    /// </summary>
    internal class InfluxDbResultPublisher : IResultPublisher
    {
        private const string DatabaseName = "scientist";

        /// <summary>
        /// Called by scientist.net to publish the experiment's result
        /// </summary>
        public Task Publish<T>(Result<T> result)
        {
            var influxDbClient = GetConfiguredClient();
            var experiment = result.Candidates.First();
            influxDbClient.Client
                .WriteAsync(DatabaseName, new Point
                {
                    Name = result.ExperimentName,
                    Tags = new Dictionary<string, object>
                    {
                        { "Matched", result.Matched },
                    },
                    Fields = new Dictionary<string, object>
                    {
                        { "ControlException", result.Control.Thrown ? result.Control.Exception.Message : "" },
                        { "ExperimentException", experiment.Thrown ? experiment.Exception.Message : "" },
                        { "ControlDuration", result.Control.Duration.Milliseconds },
                        { "ExperimentDuration", experiment.Duration.Milliseconds },
                        { "MismatchedData", JsonConvert.SerializeObject(result.MismatchedObservations.Select(obs => obs.Value)) },
                    }
                });
            // TODO, figure out async for this, may be related to https://github.com/Haacked/Scientist.net/pull/27
            return Task.FromResult(0);
        }


        private IInfluxDbClient GetConfiguredClient()
        {
            return new InfluxDbClient(
                ConfigurationManager.AppSettings["InfluxUrl"],
                ConfigurationManager.AppSettings["InfluxUsername"],
                ConfigurationManager.AppSettings["InfluxPassword"],
                InfluxDbVersion.v_0_9_5);
        }
    }
}